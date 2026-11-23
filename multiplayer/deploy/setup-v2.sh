#!/usr/bin/env bash
# Installs or updates Astro Romana v2 SIDE BY SIDE on the existing Debian VM,
# without stopping, overwriting, or touching the original /srv/astro-romana (port 8787) service or repository.
#   First run:  sudo bash /srv/astro-romana-v2/multiplayer/deploy/setup-v2.sh [domain] [acme-email]
#               (Without a domain it uses v2.<external-ip>.sslip.io on port 8788.)
#   Pages CORS: sudo EXTRA_ORIGINS=https://<user>.github.io bash /srv/astro-romana-v2/multiplayer/deploy/setup-v2.sh
#   Update:     sudo bash /srv/astro-romana-v2/multiplayer/deploy/setup-v2.sh
set -euo pipefail

REPO_URL=${REPO_URL:-git@github.com:Sabor-Pinguim/astro-romana-v2.git}
BRANCH=${BRANCH:-main}
APP_DIR=/srv/astro-romana-v2
APP_USER=astro
CONF_DIR=/etc/astro-romana-v2
SERVICE_NAME=astro-rooms-v2
NODE_MAJOR=22
ROOMS_PORT=8788

[ "$(id -u)" = 0 ] || { echo "Run with sudo." >&2; exit 1; }
cd /
step() { printf '\n== %s\n' "$*"; }

# ---------------------------------------------------------------- settings (arguments win over the saved ones)
mkdir -p "$CONF_DIR"
arg_extra=${EXTRA_ORIGINS:-}
DOMAIN='' ACME_EMAIL='' EXTRA_ORIGINS=''
# shellcheck disable=SC1091
[ -f "$CONF_DIR/site.env" ] && . "$CONF_DIR/site.env"
[[ $DOMAIN == *.sslip.io ]] && DOMAIN=''
DOMAIN=${1:-$DOMAIN}
ACME_EMAIL=${2:-$ACME_EMAIL}
EXTRA_ORIGINS=${arg_extra:-$EXTRA_ORIGINS}
if [ -z "$DOMAIN" ]; then
  ip=$(curl -fsS -m 3 -H 'Metadata-Flavor: Google' \
    http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip || true)
  [ -n "$ip" ] || { echo "Could not read the external IP; pass the domain: sudo bash $0 v2.example.com" >&2; exit 1; }
  DOMAIN="v2.${ip//./-}.sslip.io"
fi
[[ $DOMAIN =~ ^[A-Za-z0-9.-]+$ ]] || { echo "Invalid domain: $DOMAIN" >&2; exit 1; }
[ -z "$ACME_EMAIL" ] || [[ $ACME_EMAIL =~ ^[^[:space:]@]+@[^[:space:]@]+$ ]] || { echo "Invalid email: $ACME_EMAIL" >&2; exit 1; }
[[ $EXTRA_ORIGINS =~ ^[A-Za-z0-9.:/,_-]*$ ]] || { echo "Invalid EXTRA_ORIGINS (comma-separated origins): $EXTRA_ORIGINS" >&2; exit 1; }
printf 'DOMAIN=%s\nACME_EMAIL=%s\nEXTRA_ORIGINS=%s\n' "$DOMAIN" "$ACME_EMAIL" "$EXTRA_ORIGINS" > "$CONF_DIR/site.env"
echo "Site v2: https://$DOMAIN (internal port $ROOMS_PORT)"

# ---------------------------------------------------------------- ensure packages exist (skip apt if already present)
step packages
if ! command -v node >/dev/null || ! command -v caddy >/dev/null || ! command -v git >/dev/null; then
  export DEBIAN_FRONTEND=noninteractive
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
fi
echo "node $(node -v) · $(caddy version | cut -d' ' -f1)"

# ---------------------------------------------------------------- service user and deploy key
step "user $APP_USER"
home=/var/lib/$APP_USER
id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir "$home" --shell /usr/sbin/nologin "$APP_USER"
as_app() { runuser -u "$APP_USER" -- env HOME="$home" "$@"; }
key=$home/.ssh/id_ed25519
if [ ! -f "$key" ]; then
  as_app mkdir -p -m 700 "$home/.ssh"
  as_app ssh-keygen -q -t ed25519 -N '' -C "astro-romana-vm@$(hostname)" -f "$key"
fi
export GIT_SSH_COMMAND="ssh -i $key -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

# ---------------------------------------------------------------- v2 repository checkout
step repository
if [ ! -d "$APP_DIR/.git" ]; then
  install -d -o "$APP_USER" -g "$APP_USER" -m 0755 "$APP_DIR"
  if ! as_app git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"; then
    repo_page=$(sed -E 's#^git@github\.com:#https://github.com/#; s#\.git$##' <<<"$REPO_URL")
    cat <<EOF

The VM cannot read the v2 repository yet. On GitHub, add this key as a deploy key, read-only
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

# ---------------------------------------------------------------- room server v2 (systemd, port 8788 + SQLite)
step "room server v2"
restart_rooms=0
if touched multiplayer/ || [ ! -d "$APP_DIR/multiplayer/node_modules" ]; then
  as_app bash -c 'cd "$1" && npm ci --omit=dev --no-audit --no-fund' _ "$APP_DIR/multiplayer"
  restart_rooms=1
fi
put() {
  local tmp; tmp=$(mktemp)
  cat > "$tmp"
  if [ -f "$1" ] && cmp -s "$tmp" "$1"; then rm -f "$tmp"; return 1; fi
  install -m "${2:-0644}" "$tmp" "$1"; rm -f "$tmp"
}
if printf 'PORT=%s\nHOST=127.0.0.1\nDB_PATH=/var/lib/%s/astro.sqlite\nALLOWED_ORIGINS=https://%s,https://sabor-pinguim.github.io,null%s\n' \
  "$ROOMS_PORT" "$SERVICE_NAME" "$DOMAIN" "${EXTRA_ORIGINS:+,$EXTRA_ORIGINS}" | put "$CONF_DIR/rooms.env"; then
  restart_rooms=1
fi

if put "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Astro Romana v2 room server (multiplayer + SQLite)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR/multiplayer
EnvironmentFile=$CONF_DIR/rooms.env
StateDirectory=$SERVICE_NAME
ExecStart=/usr/bin/node server.mjs
KillSignal=SIGTERM
TimeoutStopSec=10
Restart=always
RestartSec=2

NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
LockPersonality=true
MemoryMax=512M

[Install]
WantedBy=multi-user.target
EOF
then
  systemctl daemon-reload
  restart_rooms=1
fi

systemctl enable --quiet "$SERVICE_NAME"
if [ "$restart_rooms" = 1 ] || ! systemctl is-active --quiet "$SERVICE_NAME"; then
  rooms=$(curl -fsS -m 2 "http://127.0.0.1:$ROOMS_PORT/health" 2>/dev/null | grep -o '"rooms":[0-9]*' | cut -d: -f2 || true)
  [ -n "$rooms" ] && [ "$rooms" != 0 ] && echo "Restarting $SERVICE_NAME with $rooms open room(s)..."
  systemctl restart "$SERVICE_NAME"
else
  echo "unchanged, still running"
fi
for _ in $(seq 1 20); do curl -fsS -m 1 "http://127.0.0.1:$ROOMS_PORT/health" >/dev/null 2>&1 && break; sleep 0.5; done
curl -fsS -m 2 "http://127.0.0.1:$ROOMS_PORT/health" >/dev/null || { journalctl -u "$SERVICE_NAME" -n 30 --no-pager; echo "Room server v2 is not answering." >&2; exit 1; }

# ---------------------------------------------------------------- Caddy (append v2 block alongside existing site without overwriting it)
step caddy
caddy_changed=0
if put "$CONF_DIR/Caddyfile.v2" <<EOF
# Side-by-side site block for Astro Romana v2 (generated by $APP_DIR/multiplayer/deploy/setup-v2.sh)
$DOMAIN {
	encode zstd gzip
	handle /ws {
		reverse_proxy 127.0.0.1:$ROOMS_PORT {
			stream_close_delay 10m
		}
	}
	handle /health {
		reverse_proxy 127.0.0.1:$ROOMS_PORT
	}
	handle /api/* {
		reverse_proxy 127.0.0.1:$ROOMS_PORT
	}
	handle {
		root * $APP_DIR
		file_server {
			hide .* node_modules
		}
	}
}
EOF
then
  caddy_changed=1
fi

CADDYFILE=/etc/caddy/Caddyfile
if [ ! -f "$CADDYFILE" ]; then
  printf 'import %s/Caddyfile.v2\n' "$CONF_DIR" > "$CADDYFILE"
  caddy_changed=1
elif ! grep -Fq "import $CONF_DIR/Caddyfile.v2" "$CADDYFILE"; then
  cp -a "$CADDYFILE" "${CADDYFILE}.bak-before-v2"
  printf '\nimport %s/Caddyfile.v2\n' "$CONF_DIR" >> "$CADDYFILE"
  caddy_changed=1
fi

caddy validate --config "$CADDYFILE" --adapter caddyfile >/dev/null 2>&1 \
  || { caddy validate --config "$CADDYFILE" --adapter caddyfile; exit 1; }
if [ "$caddy_changed" = 1 ]; then
  systemctl enable --quiet caddy
  systemctl reload-or-restart caddy
  echo "reloaded (kept existing site intact)"
else
  systemctl enable --now --quiet caddy
  echo "unchanged"
fi

cat <<EOF

Done (v2 running alongside v1).
  Game v2         https://$DOMAIN/
  WebSocket v2    wss://$DOMAIN/ws
  Health v2       https://$DOMAIN/health
  API v2          https://$DOMAIN/api/rooms   ·   https://$DOMAIN/api/leaderboard
Logs: journalctl -u $SERVICE_NAME -f   ·   journalctl -u caddy -f
Update v2 later: sudo bash $APP_DIR/multiplayer/deploy/setup-v2.sh
EOF
