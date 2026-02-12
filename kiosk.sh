#!/bin/bash
# ─────────────────────────────────────────────────────────
# Kesir Kâşifi — Raspberry Pi Kiosk Modu
# ─────────────────────────────────────────────────────────
# Pi açıldığında otomatik olarak:
#   1. picam_server.py başlatır (kamera + web sunucu)
#   2. Chromium'u tam ekran kiosk modunda açar
#
# Kurulum:
#   chmod +x kiosk.sh
#   ./install-kiosk.sh
#
# Manuel çalıştırma:
#   ./kiosk.sh
#
# Durdurma:
#   Ctrl+F4 (Chromium'u kapat) veya ./kiosk.sh stop
# ─────────────────────────────────────────────────────────

REPO_DIR="$HOME/Kesir-Sayi-Dogrusu-camera"
PORT=8080
URL="http://localhost:${PORT}"
LOG_DIR="$REPO_DIR/logs"
PICAM_LOG="$LOG_DIR/picam.log"
KIOSK_LOG="$LOG_DIR/kiosk.log"

mkdir -p "$LOG_DIR"

# ── Durdurma komutu ──
if [ "$1" = "stop" ]; then
    echo "Kesir Kâşifi durduruluyor..."
    pkill -f "picam_server.py" 2>/dev/null
    pkill -f "chromium.*localhost:${PORT}" 2>/dev/null
    echo "Durduruldu."
    exit 0
fi

# ── Önceki işlemleri temizle ──
pkill -f "picam_server.py" 2>/dev/null
pkill -f "chromium.*localhost:${PORT}" 2>/dev/null
sleep 1

echo "$(date) — Kesir Kâşifi Kiosk başlatılıyor..." | tee -a "$KIOSK_LOG"

# ── Ekran koruyucuyu ve uyku modunu kapat ──
export DISPLAY=:0
xset s off 2>/dev/null
xset -dpms 2>/dev/null
xset s noblank 2>/dev/null

# ── Fare imlecini gizle (unclutter varsa) ──
if command -v unclutter &>/dev/null; then
    unclutter -idle 0.5 -root &
fi

# ── picam_server.py başlat ──
echo "$(date) — picam_server.py başlatılıyor..." | tee -a "$KIOSK_LOG"
cd "$REPO_DIR"
python3 picam_server.py >> "$PICAM_LOG" 2>&1 &
PICAM_PID=$!

# Sunucunun hazır olmasını bekle
echo "Kamera sunucusu bekleniyor..."
for i in $(seq 1 15); do
    if curl -s "http://localhost:${PORT}/camera/status" > /dev/null 2>&1; then
        echo "$(date) — Kamera sunucusu hazır!" | tee -a "$KIOSK_LOG"
        break
    fi
    sleep 1
done

# ── Chromium'u kiosk modunda başlat ──
echo "$(date) — Chromium kiosk modu başlatılıyor..." | tee -a "$KIOSK_LOG"
chromium \
    --kiosk \
    --use-fake-ui-for-media-stream \
    --noerrdialogs \
    --disable-infobars \
    --disable-translate \
    --disable-features=TranslateUI \
    --disable-session-crashed-bubble \
    --disable-component-update \
    --check-for-update-interval=31536000 \
    --autoplay-policy=no-user-gesture-required \
    --start-fullscreen \
    --disable-restore-session-state \
    "$URL" >> "$KIOSK_LOG" 2>&1

# Chromium kapanınca picam_server'ı da durdur
kill $PICAM_PID 2>/dev/null
echo "$(date) — Kiosk kapatıldı." | tee -a "$KIOSK_LOG"
