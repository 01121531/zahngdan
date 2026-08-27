#!/usr/bin/env bash
set -Eeuo pipefail

readonly update_host="${QINGZHANG_UPDATE_HOST:?QINGZHANG_UPDATE_HOST is required}"
readonly update_port='8871'

if ! /usr/sbin/iptables -C INPUT -p tcp -s "$update_host" -d "$update_host" --dport "$update_port" -j ACCEPT 2>/dev/null; then
  /usr/sbin/iptables -I INPUT 1 -p tcp -s "$update_host" -d "$update_host" --dport "$update_port" -j ACCEPT
fi

if ! /usr/sbin/iptables -C INPUT -p tcp --dport "$update_port" -j DROP 2>/dev/null; then
  /usr/sbin/iptables -I INPUT 2 -p tcp --dport "$update_port" -j DROP
fi
