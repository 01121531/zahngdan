#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo 'Run this installer as root' >&2
  exit 1
fi

readonly SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly UPDATER_UNIT='/etc/systemd/system/qingzhang-updater.service'
readonly APP_DROPIN_DIR='/etc/systemd/system/qingzhang.service.d'
readonly APP_DROPIN="$APP_DROPIN_DIR/online-update.conf"
readonly SUDOERS_FILE='/etc/sudoers.d/qingzhang-updater'
readonly WORKER_ENV_FILE='/etc/qingzhang-worker.env'

install -d -m 0755 /usr/local/lib/qingzhang-updater
install -m 0755 "$SOURCE_DIR/qingzhang-updater.mjs" /usr/local/lib/qingzhang-updater/server.mjs
install -m 0755 "$SOURCE_DIR/qingzhang-update.sh" /usr/local/sbin/qingzhang-update

printf '%s\n' 'qingzhang ALL=(root) NOPASSWD: /usr/local/sbin/qingzhang-update' > "$SUDOERS_FILE"
chmod 0440 "$SUDOERS_FILE"
visudo -cf "$SUDOERS_FILE" >/dev/null

printf '%s\n' 'QINGZHANG_UPDATER_ENABLED=true' > "$WORKER_ENV_FILE"
chown root:qingzhang "$WORKER_ENV_FILE"
chmod 0640 "$WORKER_ENV_FILE"

install -d -m 0755 "$APP_DROPIN_DIR"
printf '%s\n' \
  '[Service]' \
  'ExecStart=' \
  'ExecStart=/opt/qingzhang/node_modules/.bin/wrangler dev --config /opt/qingzhang/dist/server/wrangler.json --ip 0.0.0.0 --port 8866 --persist-to /var/lib/qingzhang --show-interactive-dev-session=false --env-file /etc/qingzhang-worker.env' \
  > "$APP_DROPIN"

printf '%s\n' \
  '[Unit]' \
  'Description=Qingzhang database-queue update service' \
  'After=qingzhang.service' \
  'Wants=qingzhang.service' \
  '' \
  '[Service]' \
  'Type=simple' \
  'User=qingzhang' \
  'Group=qingzhang' \
  'Environment=HOME=/var/lib/qingzhang' \
  'Environment=QINGZHANG_UPDATE_SCRIPT=/usr/local/sbin/qingzhang-update' \
  'Environment=QINGZHANG_D1_DIR=/var/lib/qingzhang/v3/d1/miniflare-D1DatabaseObject' \
  'ExecStart=/usr/bin/node --no-warnings /usr/local/lib/qingzhang-updater/server.mjs' \
  'Restart=always' \
  'RestartSec=3' \
  'PrivateTmp=true' \
  'ProtectHome=true' \
  'UMask=0077' \
  '' \
  '[Install]' \
  'WantedBy=multi-user.target' \
  > "$UPDATER_UNIT"

systemctl daemon-reload
systemctl enable qingzhang-updater.service
systemctl restart qingzhang.service
systemctl restart qingzhang-updater.service

if ! systemctl is-active --quiet qingzhang-updater.service; then
  echo 'Updater service did not become ready' >&2
  exit 1
fi

legacy_host="$(sed -n 's/^QINGZHANG_UPDATE_HOST=//p' /etc/qingzhang-updater.env 2>/dev/null | head -n 1)"
if [[ -n "$legacy_host" ]]; then
  /usr/sbin/iptables -D INPUT -p tcp -s "$legacy_host" -d "$legacy_host" --dport 8871 -j ACCEPT 2>/dev/null || true
fi
/usr/sbin/iptables -D INPUT -p tcp --dport 8871 -j DROP 2>/dev/null || true
/usr/sbin/ip address del 10.254.254.1/32 dev lo 2>/dev/null || true
rm -f /etc/qingzhang-updater.env /usr/local/sbin/qingzhang-update-firewall

echo 'Qingzhang online updater installed'
