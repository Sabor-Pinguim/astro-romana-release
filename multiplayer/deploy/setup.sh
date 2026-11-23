#!/usr/bin/env bash
# Installs or updates Astro Romana on a Debian VM: the game (static files) and the room server, behind Caddy (HTTPS).
#   First run:  sudo bash setup.sh [domain] [acme-email]
#               Other pages that may use this room server (e.g. the game on GitHub Pages with ?server=wss://<domain>/ws):
#               sudo EXTRA_ORIGINS=https://<user>.github.io bash setup.sh   (saved like the domain)
#               Without a domain it uses <external-ip>.sslip.io. The first run prints a deploy key for GitHub and
#               stops; add the key to the repository and run it again.
#   Update:     sudo bash /srv/astro-romana/multiplayer/deploy/setup.sh
#               Pulls the repository. The room server restarts only when multiplayer/ changed (open rooms close);
#               game files are live as soon as they are pulled.
set -euo pipefail

REPO_URL=${REPO_URL:-git@github.com:Sabor-Pinguim/astro-romana-v2.git}
BRANCH=${BRANCH:-main}
APP_DIR=/srv/astro-romana   # also in astro-rooms.service and Caddyfile.site
APP_USER=astro
CONF_DIR=/etc/astro-romana
NODE_MAJOR=22               # multiplayer/package.json: engines node >= 22
ROOMS_PORT=8787

[ "$(id -u)" = 0 ] || { echo "Run with sudo." >&2; exit 1; }
cd /   # the service user cannot enter the caller's home (git and npm fail in a working directory they cannot read)
step() { printf '\n== %s\n' "$*"; }

# ---------------------------------------------------------------- settings (arguments win over the saved ones)
mkdir -p "$CONF_DIR"
arg_extra=${EXTRA_ORIGINS:-}
DOMAIN='' ACME_EMAIL='' EXTRA_ORIGINS=''
# shellcheck disable=SC1091
[ -f "$CONF_DIR/site.env" ] && . "$CONF_DIR/site.env"
# An sslip.io name comes from the IP: work it out again, since an ephemeral IP changes when the VM is stopped and started.
[[ $DOMAIN == *.sslip.io ]] && DOMAIN=''
DOMAIN=${1:-$DOMAIN}
ACME_EMAIL=${2:-$ACME_EMAIL}
EXTRA_ORIGINS=${arg_extra:-$EXTRA_ORIGINS}
if [ -z "$DOMAIN" ]; then
  ip=$(curl -fsS -m 3 -H 'Metadata-Flavor: Google' \
    http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip || true)
  [ -n "$ip" ] || { echo "Could not read the external IP; pass the domain: sudo bash setup.sh game.example.com" >&2; exit 1; }
  DOMAIN="${ip//./-}.sslip.io"
fi
[[ $DOMAIN =~ ^[A-Za-z0-9.-]+$ ]] || { echo "Invalid domain: $DOMAIN" >&2; exit 1; }
[ -z "$ACME_EMAIL" ] || [[ $ACME_EMAIL =~ ^[^[:space:]@]+@[^[:space:]@]+$ ]] || { echo "Invalid email: $ACME_EMAIL" >&2; exit 1; }
[[ $EXTRA_ORIGINS =~ ^[A-Za-z0-9.:/,_-]*$ ]] || { echo "Invalid EXTRA_ORIGINS (comma-separated origins): $EXTRA_ORIGINS" >&2; exit 1; }
printf 'DOMAIN=%s\nACME_EMAIL=%s\nEXTRA_ORIGINS=%s\n' "$DOMAIN" "$ACME_EMAIL" "$EXTRA_ORIGINS" > "$CONF_DIR/site.env"
echo "Site: https://$DOMAIN"

# ---------------------------------------------------------------- packages: git, Node 22 (NodeSource), Caddy
step packages
export DEBIAN_FRONTEND=noninteractive
# A new VM runs its own apt jobs for a few minutes after boot: wait for the lock instead of failing.
aptq() { apt-get -o DPkg::Lock::Timeout=600 -qq "$@"; }
aptq update
aptq install -y git curl ca-certificates gnupg openssh-client >/dev/null
install -d -m 0755 /etc/apt/keyrings
node_major=$(command -v node >/dev/null && node -p 'process.versions.node.split(".")[0]' || echo 0)
if [ "$node_major" -lt "$NODE_MAJOR" ]; then
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  aptq update && aptq install -y nodejs >/dev/null
fi
if ! command -v caddy >/dev/null; then
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
  aptq update && aptq install -y caddy >/dev/null
fi
echo "node $(node -v) · $(caddy version | cut -d' ' -f1)"

# ---------------------------------------------------------------- service user and its read-only deploy key
step "user $APP_USER"
home=/var/lib/$APP_USER
id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir "$home" --shell /usr/sbin/nologin "$APP_USER"
as_app() { runuser -u "$APP_USER" -- env HOME="$home" "$@"; }   # HOME: its ssh known_hosts and npm cache
key=$home/.ssh/id_ed25519
if [ ! -f "$key" ]; then
  as_app mkdir -p -m 700 "$home/.ssh"
  as_app ssh-keygen -q -t ed25519 -N '' -C "astro-romana-vm@$(hostname)" -f "$key"
fi
export GIT_SSH_COMMAND="ssh -i $key -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

# ---------------------------------------------------------------- repository checkout (what Caddy serves)
step repository
if [ ! -d "$APP_DIR/.git" ]; then
  install -d -o "$APP_USER" -g "$APP_USER" -m 0755 "$APP_DIR"
  if ! as_app git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"; then
    repo_page=$(sed -E 's#^git@github\.com:#https://github.com/#; s#\.git$##' <<<"$REPO_URL")
    cat <<EOF

The VM cannot read the repository yet. On GitHub, add this key as a deploy key, read-only
("Allow write access" off), at $repo_page/settings/keys:

$(cat "$key.pub")

Then run this script again.
EOF
    exit 2
  fi
  changed=ALL
else
  before=$(as_app git -C "$APP_DIR" rev-parse HEAD)
  as_app git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
  changed=$(as_app git -C "$APP_DIR" diff --name-only "$before" HEAD)
fi
touched() { [ "$changed" = ALL ] || grep -q "^$1" <<<"$changed"; }
echo "at $(as_app git -C "$APP_DIR" log -1 --format='%h %s')"

# ---------------------------------------------------------------- room server (systemd)
step "room server"
restart_rooms=0
if touched multiplayer/ || [ ! -d "$APP_DIR/multiplayer/node_modules" ]; then
  as_app bash -c 'cd "$1" && npm ci --omit=dev --no-audit --no-fund' _ "$APP_DIR/multiplayer"
  restart_rooms=1
fi
# Writes stdin to a file; true when the content changed.
put() {
  local tmp; tmp=$(mktemp)
  cat > "$tmp"
  if [ -f "$1" ] && cmp -s "$tmp" "$1"; then rm -f "$tmp"; return 1; fi
  install -m "${2:-0644}" "$tmp" "$1"; rm -f "$tmp"
}
# "null" lets pages opened from file:// (local testing with ?server=) join too.
if printf 'PORT=%s\nHOST=127.0.0.1\nDB_PATH=/var/lib/astro-romana/astro.sqlite\nALLOWED_ORIGINS=https://%s,null%s\n' "$ROOMS_PORT" "$DOMAIN" "${EXTRA_ORIGINS:+,$EXTRA_ORIGINS}" \
  | put "$CONF_DIR/rooms.env"; then restart_rooms=1; fi
if put /etc/systemd/system/astro-rooms.service < "$APP_DIR/multiplayer/deploy/astro-rooms.service"; then
  systemctl daemon-reload; restart_rooms=1
fi
systemctl enable --quiet astro-rooms
if [ "$restart_rooms" = 1 ] || ! systemctl is-active --quiet astro-rooms; then
  rooms=$(curl -fsS -m 2 "http://127.0.0.1:$ROOMS_PORT/health" 2>/dev/null | grep -o '"rooms":[0-9]*' | cut -d: -f2 || true)
  [ -n "$rooms" ] && [ "$rooms" != 0 ] && echo "Restarting with $rooms open room(s): their players go back to the menu."
  systemctl restart astro-rooms
else
  echo "unchanged, still running"
fi
for _ in $(seq 1 20); do curl -fsS -m 1 "http://127.0.0.1:$ROOMS_PORT/health" >/dev/null 2>&1 && break; sleep 0.5; done
curl -fsS -m 2 "http://127.0.0.1:$ROOMS_PORT/health" >/dev/null || { journalctl -u astro-rooms -n 30 --no-pager; echo "Room server is not answering." >&2; exit 1; }

# ---------------------------------------------------------------- Caddy (HTTPS + static game + /ws)
step caddy
{
  echo "# Written by $APP_DIR/multiplayer/deploy/setup.sh. Change the site in multiplayer/deploy/Caddyfile.site and run the script again."
  [ -n "$ACME_EMAIL" ] && printf '{\n\temail %s\n}\n' "$ACME_EMAIL"
  printf '\n%s {\n\timport %s/multiplayer/deploy/Caddyfile.site\n}\n' "$DOMAIN" "$APP_DIR"
} > "$CONF_DIR/Caddyfile.new"
caddy validate --config "$CONF_DIR/Caddyfile.new" --adapter caddyfile >/dev/null 2>&1 \
  || { caddy validate --config "$CONF_DIR/Caddyfile.new" --adapter caddyfile; exit 1; }
if put /etc/caddy/Caddyfile < "$CONF_DIR/Caddyfile.new" || touched multiplayer/deploy/Caddyfile.site; then
  systemctl enable --quiet caddy
  systemctl reload-or-restart caddy
  echo "reloaded"
else
  systemctl enable --now --quiet caddy
  echo "unchanged"
fi
rm -f "$CONF_DIR/Caddyfile.new"

cat <<EOF

Done.
  Game            https://$DOMAIN/
  Rooms test page https://$DOMAIN/multiplayer/demo/
  WebSocket       wss://$DOMAIN/ws
  Health          https://$DOMAIN/health
  API             https://$DOMAIN/api/rooms   ·   https://$DOMAIN/api/leaderboard
The first HTTPS request can take a few seconds while Caddy gets the certificate.
Logs: journalctl -u astro-rooms -f   ·   journalctl -u caddy -f
Update later: sudo bash $APP_DIR/multiplayer/deploy/setup.sh
EOF
