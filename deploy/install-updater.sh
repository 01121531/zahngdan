#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo 'Run this installer as root' >&2
  exit 1
fi

readonly SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly TOKEN_FILE='/etc/qingzhang-updater.env'
readonly WORKER_ENV_FILE='/etc/qingzhang-worker.env'
readonly UPDATER_UNIT='/etc/systemd/system/qingzhang-updater.service'
readonly APP_DROPIN_DIR='/etc/systemd/system/qingzhang.service.d'
readonly APP_DROPIN="$APP_DROPIN_DIR/online-update.conf"
readonly UPDATE_HOST="${QINGZHANG_UPDATE_HOST_OVERRIDE:-10.254.254.1}"

install -d -m 0755 /usr/local/lib/qingzhang-updater
install -m 0755 "$SOURCE_DIR/qingzhang-updater.mjs" /usr/local/lib/qingzhang-updater/server.mjs
install -m 0755 "$SOURCE_DIR/qingzhang-update.sh" /usr/local/sbin/qingzhang-update
install -m 0755 "$SOURCE_DIR/qingzhang-update-firewall.sh" /usr/local/sbin/qingzhang-update-firewall

if [[ -f "$TOKEN_FILE" ]]; then
  update_token="$(sed -n 's/^QINGZHANG_UPDATE_TOKEN=//p' "$TOKEN_FILE" | head -n 1)"
else
  update_token="$(openssl rand -hex 32)"
fi
if [[ ${#update_token} -lt 32 ]]; then
  echo 'Existing update token is invalid' >&2
  exit 1
fi

umask 0077
printf 'QINGZHANG_UPDATE_TOKEN=%s\nQINGZHANG_UPDATE_HOST=%s\nQINGZHANG_UPDATE_SCRIPT=/usr/local/sbin/qingzhang-update\nQINGZHANG_UPDATE_STATUS=/var/lib/qingzhang/update-status.json\n' "$update_token" "$UPDATE_HOST" > "$TOKEN_FILE"
printf 'QINGZHANG_UPDATE_URL=http://%s:8871\nQINGZHANG_UPDATE_TOKEN=%s\n' "$UPDATE_HOST" "$update_token" > "$WORKER_ENV_FILE"
chown root:root "$TOKEN_FILE"
chown root:qingzhang "$WORKER_ENV_FILE"
chmod 0600 "$TOKEN_FILE"
chmod 0640 "$WORKER_ENV_FILE"

install -d -m 0755 "$APP_DROPIN_DIR"
printf '%s\n' \
  '[Service]' \
  'ExecStart=' \
  'ExecStart=/opt/qingzhang/node_modules/.bin/wrangler dev --config /opt/qingzhang/dist/server/wrangler.json --ip 0.0.0.0 --port 8866 --persist-to /var/lib/qingzhang --show-interactive-dev-session=false --env-file /etc/qingzhang-worker.env' \
  > "$APP_DROPIN"

printf '%s\n' \
  '[Unit]' \
  'Description=Qingzhang authenticated local update service' \
  'After=network-online.target' \
  'Wants=network-online.target' \
  '' \
  '[Service]' \
  'Type=simple' \
  'User=root' \
  'Group=root' \
  'EnvironmentFile=/etc/qingzhang-updater.env' \
  'ExecStartPre=/usr/local/sbin/qingzhang-update-firewall' \
  'ExecStartPre=-/usr/sbin/ip address add 10.254.254.1/32 dev lo' \
  'ExecStart=/usr/bin/node /usr/local/lib/qingzhang-updater/server.mjs' \
  'Restart=on-failure' \
  'RestartSec=3' \
  'NoNewPrivileges=true' \
  'PrivateTmp=true' \
  'ProtectHome=true' \
  'UMask=0077' \
  '' \
  '[Install]' \
  'WantedBy=multi-user.target' \
  > "$UPDATER_UNIT"

systemctl daemon-reload
systemctl enable qingzhang-updater.service
systemctl restart qingzhang-updater.service
systemctl restart qingzhang.service

updater_ready='false'
for _ in {1..10}; do
  if curl --fail --silent --show-error --connect-timeout 1 --max-time 2 \
    --header "Authorization: Bearer $update_token" \
    "http://$UPDATE_HOST:8871/status" >/dev/null; then
    updater_ready='true'
    break
  fi
  sleep 1
done
if [[ "$updater_ready" != 'true' ]]; then
  echo 'Updater service did not become ready' >&2
  exit 1
fi

echo 'Qingzhang online updater installed'
