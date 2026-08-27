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

install -d -m 0755 /usr/local/lib/qingzhang-updater
install -m 0755 "$SOURCE_DIR/qingzhang-updater.mjs" /usr/local/lib/qingzhang-updater/server.mjs
install -m 0755 "$SOURCE_DIR/qingzhang-update.sh" /usr/local/sbin/qingzhang-update

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
printf 'QINGZHANG_UPDATE_TOKEN=%s\nQINGZHANG_UPDATE_SCRIPT=/usr/local/sbin/qingzhang-update\nQINGZHANG_UPDATE_STATUS=/var/lib/qingzhang/update-status.json\n' "$update_token" > "$TOKEN_FILE"
printf 'QINGZHANG_UPDATE_URL=http://127.0.0.1:8871\nQINGZHANG_UPDATE_TOKEN=%s\n' "$update_token" > "$WORKER_ENV_FILE"
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
systemctl enable --now qingzhang-updater.service
systemctl restart qingzhang.service

curl --fail --silent --show-error \
  --header "Authorization: Bearer $update_token" \
  http://127.0.0.1:8871/status >/dev/null

echo 'Qingzhang online updater installed'
