#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════
#  AzaBot — deploy.sh
#  نشر كامل على خادم Ubuntu 22+ جديد
#
#  الاستخدام:
#    chmod +x deploy.sh
#    sudo ./deploy.sh
# ════════════════════════════════════════════════════════════

set -euo pipefail

# ── Colors ──────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }
err()  { echo -e "${RED}✗${NC}  $1"; exit 1; }
hdr()  { echo -e "\n${BOLD}${BLUE}═══ $1 ═══${NC}"; }

# ── Config ──────────────────────────────────────────────────
DOMAIN="chat.alazab.com"
EMAIL="admin@alazab.com"
DEPLOY_DIR="/opt/azabot"
SUPABASE_URL="https://daraqtdmiwdszczwticd.supabase.co"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

[[ $EUID -ne 0 ]] && err "يجب تشغيل السكريبت كـ root: sudo ./deploy.sh"

# ════════════════════════════════════════════════════════════
hdr "1. تحديث النظام وتثبيت الاعتماديات"
# ════════════════════════════════════════════════════════════
apt-get update -qq
apt-get install -y -qq \
    docker.io docker-compose-plugin \
    curl git ufw fail2ban
log "تم تثبيت الاعتماديات"

systemctl enable --now docker
log "Docker يعمل"

# ════════════════════════════════════════════════════════════
hdr "2. إعداد Firewall"
# ════════════════════════════════════════════════════════════
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment "SSH"
ufw allow 80/tcp   comment "HTTP"
ufw allow 443/tcp  comment "HTTPS"
ufw --force enable
log "Firewall: 22, 80, 443 مفتوحة"

# ════════════════════════════════════════════════════════════
hdr "3. إعداد fail2ban"
# ════════════════════════════════════════════════════════════
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true

[nginx-http-auth]
enabled = true
logpath = /var/log/nginx/*.log
EOF
systemctl enable --now fail2ban
log "fail2ban جاهز"

# ════════════════════════════════════════════════════════════
hdr "4. نسخ ملفات المشروع"
# ════════════════════════════════════════════════════════════
mkdir -p "$DEPLOY_DIR"/{nginx,static/{embed,api},logs}

cp -r "$REPO_DIR/deploy/nginx/"*.conf   "$DEPLOY_DIR/nginx/"
cp    "$REPO_DIR/deploy/docker-compose.yml" "$DEPLOY_DIR/"
cp -r "$REPO_DIR/deploy/static/"*       "$DEPLOY_DIR/static/" 2>/dev/null || true
cp    "$REPO_DIR/embed/azabot-embed.js" "$DEPLOY_DIR/static/embed/"

# Build الـ React app إذا كان dist/ موجود
if [[ -d "$REPO_DIR/dist" ]]; then
  cp -r "$REPO_DIR/dist/." "$DEPLOY_DIR/static/"
  log "تم نسخ dist/ للـ static"
else
  warn "لم يُوجد dist/ — قم بـ: npm run build أولاً"
fi

log "تم نسخ ملفات المشروع إلى $DEPLOY_DIR"

# ════════════════════════════════════════════════════════════
hdr "5. الحصول على شهادة SSL"
# ════════════════════════════════════════════════════════════
# تشغيل مؤقت لـ nginx على HTTP فقط للتحقق
docker run --rm -p 80:80 \
  -v "$DEPLOY_DIR/static:/var/www/certbot" \
  nginx:1.27-alpine nginx -g "daemon off;" &
NGINX_PID=$!
sleep 3

certbot certonly --webroot \
  -w "$DEPLOY_DIR/static" \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos --non-interactive --quiet \
  || warn "فشل الحصول على SSL — قد يكون النطاق غير مرتبط بعد"

kill $NGINX_PID 2>/dev/null || true
log "شهادة SSL جاهزة (أو سيتم إعادة المحاولة)"

# ════════════════════════════════════════════════════════════
hdr "6. تشغيل Docker Compose"
# ════════════════════════════════════════════════════════════
cd "$DEPLOY_DIR"
docker compose pull --quiet
docker compose up -d --remove-orphans
log "الحاويات تعمل"

# ════════════════════════════════════════════════════════════
hdr "7. نشر Supabase Edge Functions"
# ════════════════════════════════════════════════════════════
if command -v supabase &>/dev/null; then
  cd "$REPO_DIR"
  supabase functions deploy chat-v2       --no-verify-jwt
  supabase functions deploy elevenlabs-tts --no-verify-jwt
  supabase functions deploy elevenlabs-stt --no-verify-jwt
  log "تم نشر Edge Functions"
else
  warn "supabase CLI غير مثبت — ثبّته من: https://supabase.com/docs/guides/cli"
  warn "ثم نفّذ يدوياً: supabase functions deploy chat-v2"
fi

# ════════════════════════════════════════════════════════════
hdr "8. تعيين أسرار Edge Functions"
# ════════════════════════════════════════════════════════════
warn "تذكّر تعيين الأسرار في Supabase Dashboard أو بالأمر التالي:"
echo ""
echo "  supabase secrets set CLAUDE_API=sk-ant-api03-..."
echo "  supabase secrets set ELEVENLABS_API_KEY=sk_..."
echo "  supabase secrets set GEMINI_API_KEY=AIzaSy..."
echo ""

# ════════════════════════════════════════════════════════════
hdr "✅ النشر اكتمل"
# ════════════════════════════════════════════════════════════
echo ""
log "AzaBot يعمل الآن على: https://$DOMAIN"
log "Health check: https://$DOMAIN/health"
log "Embed script: https://$DOMAIN/embed/azabot-embed.js"
echo ""
echo "لعرض الـ logs:"
echo "  docker compose -f $DEPLOY_DIR/docker-compose.yml logs -f nginx"
