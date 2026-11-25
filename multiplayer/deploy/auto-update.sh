#!/usr/bin/env bash
# Keeps the v2 VM on the latest main with no one logging in. setup-v2.sh installs a copy of this file as
# /usr/local/sbin/astro-update-v2 and a systemd timer (astro-update-v2.timer) that runs it every minute:
#   1. pulls origin/main into the checkout (fast-forward only). Caddy serves the game straight from the checkout,
#      so new pages are live at once;
#   2. when the room server's version (multiplayer/package.json, raised with `npm run version:bump:server`) is not
#      the one running (/health), reinstalls its dependencies and restarts it. It waits until no room is open, for
#      MAX_WAIT_MIN minutes at most, so an update does not end a match.
# Code pulled from GitHub never runs as root here: this copy changes only when setup-v2.sh runs again, and so do
# the Caddy and systemd settings in multiplayer/deploy/ (the log says when they changed).
# Logs: journalctl -u astro-update-v2 -f   ·   pause: sudo systemctl disable --now astro-update-v2.timer
set -euo pipefail

APP_DIR=${APP_DIR:-/srv/astro-romana-v2}
APP_USER=${APP_USER:-astro}
BRANCH=${BRANCH:-main}
SERVICE_NAME=${SERVICE_NAME:-astro-rooms-v2}
ROOMS_PORT=${ROOMS_PORT:-8788}
STATE_DIR=${STATE_DIR:-/var/lib/astro-update-v2}
MAX_WAIT_MIN=${MAX_WAIT_MIN:-60} # game-balance: how long a server update may wait for open rooms to close

mkdir -p "$STATE_DIR"
exec 9>"$STATE_DIR/lock"
flock -n 9 || exit 0 # the last run (or setup-v2.sh) is still going: try again next minute

home=$(getent passwd "$APP_USER" | cut -d: -f6)
as_app() {
  runuser -u "$APP_USER" -- env HOME="$home" \
    GIT_SSH_COMMAND="ssh -i $home/.ssh/id_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" "$@"
}
repo() { as_app git -C "$APP_DIR" "$@"; }
health() { curl -fsS -m 2 "http://127.0.0.1:$ROOMS_PORT/health" 2>/dev/null || true; }
# One field of a JSON object on stdin ('' when missing or not JSON).
json() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let v;try{v=JSON.parse(s)[process.argv[1]]}catch{}console.log(v??"")})' "$1"; }

# ---- 1. pull
repo fetch --quiet origin "$BRANCH"
before=$(repo rev-parse HEAD)
target=$(repo rev-parse "origin/$BRANCH")
if [ "$before" != "$target" ]; then
  if ! repo merge --ff-only --quiet "$target"; then
    echo "Could not fast-forward $APP_DIR to origin/$BRANCH (changed by hand?): it stays at $(repo log -1 --format=%h)." >&2
    exit 1
  fi
  echo "Pulled $(repo log -1 --format='%h %s')"
  if repo diff --name-only "$before" "$target" | grep -q '^multiplayer/deploy/'; then
    echo "multiplayer/deploy/ changed: run sudo bash $APP_DIR/multiplayer/deploy/setup-v2.sh to apply it."
  fi
fi

# ---- 2. the room server's version
wanted=$(json version < "$APP_DIR/multiplayer/package.json")
status=$(health)
running=$(json version <<<"$status")
if [ -n "$status" ] && [ "$running" = "$wanted" ]; then
  rm -f "$STATE_DIR/pending" "$STATE_DIR/failed"
  exit 0
fi
# A version that already failed to start is left to systemd's own restarts until a newer one arrives.
[ "$(cat "$STATE_DIR/failed" 2>/dev/null)" = "$wanted" ] && exit 0

now=$(date +%s) pending_version='' since=''
[ -f "$STATE_DIR/pending" ] && read -r pending_version since < "$STATE_DIR/pending"
if [ "$pending_version" != "$wanted" ]; then
  since=$now
  echo "$wanted $since" > "$STATE_DIR/pending"
fi
rooms=$(json rooms <<<"$status")
rooms=${rooms:-0}
if [ -n "$status" ] && [ "$rooms" != 0 ] && [ $((now - since)) -lt $((MAX_WAIT_MIN * 60)) ]; then
  [ "$since" = "$now" ] && echo "Room server $wanted is ready: it starts once the $rooms open room(s) close (at most $MAX_WAIT_MIN min)."
  exit 0
fi

echo "Restarting $SERVICE_NAME: ${running:-not answering} → $wanted ($rooms open room(s))"
lock_sum=$(sha256sum "$APP_DIR/multiplayer/package-lock.json" | cut -d' ' -f1)
if [ ! -d "$APP_DIR/multiplayer/node_modules" ] || [ "$(cat "$STATE_DIR/npm-lock" 2>/dev/null)" != "$lock_sum" ]; then
  as_app bash -c 'cd "$1" && npm ci --omit=dev --no-audit --no-fund' _ "$APP_DIR/multiplayer"
  echo "$lock_sum" > "$STATE_DIR/npm-lock"
fi
systemctl restart "$SERVICE_NAME"
for _ in $(seq 1 20); do
  [ "$(health | json version)" = "$wanted" ] && break
  sleep 0.5
done
if [ "$(health | json version)" = "$wanted" ]; then
  rm -f "$STATE_DIR/pending" "$STATE_DIR/failed"
  echo "Room server $wanted is up."
else
  echo "$wanted" > "$STATE_DIR/failed"
  journalctl -u "$SERVICE_NAME" -n 30 --no-pager >&2 || true
  echo "Room server $wanted is not answering: see the log above; push a fix with a new server version." >&2
  exit 1
fi
