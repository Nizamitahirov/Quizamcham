#!/usr/bin/env bash
# Jabr — serverin ilk quraşdırılması (Ubuntu 24.04, Contabo VPS).
# root kimi BİR DƏFƏ işə salın:
#   curl -fsSL https://raw.githubusercontent.com/Nizamitahirov/Quizamcham/main/scripts/server-bootstrap.sh | bash
#
# Nə edir:
#   • sistemi yeniləyir, avtomatik təhlükəsizlik yeniləmələrini açır
#   • Docker + Docker Compose quraşdırır
#   • "deploy" istifadəçisi və /opt/jabr qovluğu yaradır
#   • GitHub Actions üçün ayrıca SSH açarı yaradır (yalnız deploy istifadəçisinə giriş)
#   • firewall: yalnız 22 (SSH), 80 və 443 açıq; fail2ban (SSH brute-force qoruması)
#   • 2 GB swap
# Təkrar işə salmaq təhlükəsizdir (idempotent).
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
DEPLOY_USER=deploy
APP_DIR=/opt/jabr
KEY=/root/jabr_deploy_key

if [ "$(id -u)" -ne 0 ]; then echo "root kimi işə salın"; exit 1; fi
. /etc/os-release
echo "==> Sistem: $PRETTY_NAME"

echo "==> Paketlər yenilənir"
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg ufw fail2ban unattended-upgrades git rsync

echo "==> Docker"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

echo "==> deploy istifadəçisi və $APP_DIR"
id -u "$DEPLOY_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$DEPLOY_USER"
usermod -aG docker "$DEPLOY_USER"
mkdir -p "$APP_DIR"
chown "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"

echo "==> GitHub Actions üçün SSH açarı"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
[ -f "$KEY" ] || ssh-keygen -q -t ed25519 -N "" -C "github-actions-deploy@jabr" -f "$KEY"
AUTH="/home/$DEPLOY_USER/.ssh/authorized_keys"
touch "$AUTH"
grep -qxF "$(cat "$KEY.pub")" "$AUTH" || cat "$KEY.pub" >> "$AUTH"
chown "$DEPLOY_USER:$DEPLOY_USER" "$AUTH"
chmod 600 "$AUTH"

echo "==> Firewall (22, 80, 443)"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

echo "==> fail2ban və avtomatik təhlükəsizlik yeniləmələri"
systemctl enable --now fail2ban
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

echo "==> Swap (2 GB)"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

IP4=$(curl -fsS4 https://api.ipify.org || hostname -I | awk '{print $1}')
cat <<MSG

================================================================
 Hazırdır. İndi GitHub-da 3 "secret" əlavə edin:
 Repository → Settings → Secrets and variables → Actions → New repository secret

   SSH_HOST   =  $IP4
   SSH_USER   =  $DEPLOY_USER
   SSH_KEY    =  aşağıdakı mətnin TAMAMI (BEGIN sətrindən END sətrinə qədər)

 Bu açarı heç yerə — çata, e-poçta — yazmayın; yalnız GitHub Secrets-ə.
================================================================
MSG
cat "$KEY"
echo "================================================================"
echo " Docker: $(docker --version)"
echo " Firewall: $(ufw status | head -1)"
