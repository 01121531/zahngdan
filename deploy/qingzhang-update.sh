#!/usr/bin/env bash
set -Eeuo pipefail

readonly APP_DIR='/opt/qingzhang'
readonly PREVIOUS_DIR='/opt/qingzhang.previous'
readonly RELEASES_DIR='/opt/qingzhang-releases'
readonly ARCHIVE_URL='https://github.com/01121531/zahngdan/archive/refs/heads/main.tar.gz'
readonly SERVICE='qingzhang.service'
readonly HEALTH_URL='http://127.0.0.1:8866/login'
readonly STATIC_ASSET_RETENTION_DAYS='30'

stage_dir=''

safe_remove() {
  local target="$1"
  case "$target" in
    /opt/qingzhang.previous|/opt/qingzhang-releases/staging.*|/opt/qingzhang.failed.*)
      rm -rf -- "$target"
      ;;
    *)
      echo "Refusing to remove unexpected path: $target" >&2
      return 1
      ;;
  esac
}

cleanup_stage() {
  if [[ -n "$stage_dir" && -d "$stage_dir" ]]; then
    safe_remove "$stage_dir"
  fi
}
trap cleanup_stage EXIT

exec 9>/run/lock/qingzhang-update.lock
if ! flock -n 9; then
  echo 'Another update is already running' >&2
  exit 75
fi

for command in curl tar npm runuser systemctl cp find; do
  command -v "$command" >/dev/null
done

install -d -o root -g qingzhang -m 0750 "$RELEASES_DIR"
stage_dir="$(mktemp -d "$RELEASES_DIR/staging.XXXXXX")"
archive="$stage_dir/source.tar.gz"

curl --fail --location --retry 3 --connect-timeout 15 --max-time 120 "$ARCHIVE_URL" --output "$archive"
tar --extract --gzip --file "$archive" --directory "$stage_dir" --strip-components=1
rm -- "$archive"
chown -R qingzhang:qingzhang "$stage_dir"

runuser -u qingzhang -- env HOME=/var/lib/qingzhang npm --prefix "$stage_dir" ci --no-audit --no-fund
runuser -u qingzhang -- env HOME=/var/lib/qingzhang npm --prefix "$stage_dir" run lint
runuser -u qingzhang -- env HOME=/var/lib/qingzhang npm --prefix "$stage_dir" run typecheck
runuser -u qingzhang -- env HOME=/var/lib/qingzhang npm --prefix "$stage_dir" test -- --run
runuser -u qingzhang -- env HOME=/var/lib/qingzhang npm --prefix "$stage_dir" run build

# Keep recently deployed content-hashed assets so tabs opened before an update
# can finish client-side navigation without requesting files that just vanished.
current_static="$APP_DIR/dist/client/_next/static"
next_static="$stage_dir/dist/client/_next/static"
if [[ -d "$current_static" && -d "$next_static" ]]; then
  cp --archive --no-clobber "$current_static"/. "$next_static"/
  find "$next_static" -type f -mtime +"$STATIC_ASSET_RETENTION_DAYS" -delete
  find "$next_static" -depth -type d -empty -delete
fi

if [[ -e "$PREVIOUS_DIR" ]]; then
  [[ "$(readlink -f "$PREVIOUS_DIR")" == "$PREVIOUS_DIR" ]] || { echo 'Unsafe previous release path' >&2; exit 1; }
  safe_remove "$PREVIOUS_DIR"
fi

systemctl stop "$SERVICE"
mv -- "$APP_DIR" "$PREVIOUS_DIR"
if ! mv -- "$stage_dir" "$APP_DIR"; then
  mv -- "$PREVIOUS_DIR" "$APP_DIR"
  systemctl start "$SERVICE"
  exit 1
fi
stage_dir=''
install -d -o qingzhang -g qingzhang -m 0755 \
  "$APP_DIR/dist/server/.wrangler" \
  "$APP_DIR/node_modules/.mf"

rollback() {
  local failed_dir="/opt/qingzhang.failed.$(date +%s)"
  systemctl stop "$SERVICE" || true
  mv -- "$APP_DIR" "$failed_dir"
  mv -- "$PREVIOUS_DIR" "$APP_DIR"
  systemctl start "$SERVICE" || true
  safe_remove "$failed_dir"
}

if ! systemctl start "$SERVICE"; then
  rollback
  exit 1
fi

healthy='false'
for _ in {1..30}; do
  if curl --fail --silent --show-error --max-time 3 "$HEALTH_URL" >/dev/null; then
    healthy='true'
    break
  fi
  sleep 2
done

if [[ "$healthy" != 'true' ]]; then
  rollback
  exit 1
fi

# Refresh the root-owned updater components only after the new application is healthy.
install -m 0755 "$APP_DIR/deploy/qingzhang-updater.mjs" /usr/local/lib/qingzhang-updater/server.mjs.next
mv -- /usr/local/lib/qingzhang-updater/server.mjs.next /usr/local/lib/qingzhang-updater/server.mjs
install -m 0755 "$APP_DIR/deploy/qingzhang-update.sh" /usr/local/sbin/qingzhang-update.next
mv -- /usr/local/sbin/qingzhang-update.next /usr/local/sbin/qingzhang-update

echo 'Qingzhang update completed successfully'
