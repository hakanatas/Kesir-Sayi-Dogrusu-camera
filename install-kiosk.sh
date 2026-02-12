#!/bin/bash
# ─────────────────────────────────────────────────────────
# Kesir Kâşifi — Kiosk Modu Kurulum Scripti
# ─────────────────────────────────────────────────────────
# Bu script Pi'de bir kere çalıştırılır ve:
#   1. Gerekli paketleri kurar
#   2. Autostart dosyasını oluşturur
#   3. Pi açılışında otomatik başlatmayı ayarlar
#
# Kullanım:
#   cd ~/Kesir-Sayi-Dogrusu-camera
#   chmod +x install-kiosk.sh kiosk.sh
#   ./install-kiosk.sh
#
# Kaldırmak için:
#   ./install-kiosk.sh uninstall
# ─────────────────────────────────────────────────────────

REPO_DIR="$HOME/Kesir-Sayi-Dogrusu-camera"
AUTOSTART_DIR="$HOME/.config/autostart"
DESKTOP_FILE="$AUTOSTART_DIR/kesir-kasifi.desktop"

# ── Kaldırma ──
if [ "$1" = "uninstall" ]; then
    echo "Kiosk modu kaldırılıyor..."
    rm -f "$DESKTOP_FILE"
    echo "Otomatik başlatma kaldırıldı."
    echo "Bir sonraki yeniden başlatmada kiosk çalışmayacak."
    exit 0
fi

echo "═══════════════════════════════════════════"
echo "  Kesir Kâşifi Kiosk Modu Kurulumu"
echo "═══════════════════════════════════════════"
echo

# ── Gerekli paketleri kur ──
echo "1/3 — Gerekli paketler kontrol ediliyor..."
PACKAGES=""
if ! command -v unclutter &>/dev/null; then
    PACKAGES="$PACKAGES unclutter"
fi
if ! command -v curl &>/dev/null; then
    PACKAGES="$PACKAGES curl"
fi

if [ -n "$PACKAGES" ]; then
    echo "     Kurulacak paketler:$PACKAGES"
    sudo apt update -qq && sudo apt install -y $PACKAGES
else
    echo "     Tüm paketler zaten kurulu."
fi

# ── Script'leri çalıştırılabilir yap ──
echo "2/3 — Script izinleri ayarlanıyor..."
chmod +x "$REPO_DIR/kiosk.sh"
chmod +x "$REPO_DIR/install-kiosk.sh"
echo "     Tamam."

# ── Autostart desktop dosyası oluştur ──
echo "3/3 — Otomatik başlatma ayarlanıyor..."
mkdir -p "$AUTOSTART_DIR"
cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Type=Application
Name=Kesir Kasifi Kiosk
Comment=Kesir Kasifi tam ekran kiosk modu
Exec=bash $REPO_DIR/kiosk.sh
Terminal=false
X-GNOME-Autostart-enabled=true
EOF

echo "     Autostart dosyası: $DESKTOP_FILE"

echo
echo "═══════════════════════════════════════════"
echo "  Kurulum tamamlandı!"
echo "═══════════════════════════════════════════"
echo
echo "  Şimdi test etmek için:"
echo "    cd $REPO_DIR && ./kiosk.sh"
echo
echo "  Pi yeniden başladığında otomatik açılacak."
echo "  Kaldırmak için: ./install-kiosk.sh uninstall"
echo
echo "  Durdurmak için: ./kiosk.sh stop"
echo "  veya Ctrl+F4 ile Chromium'u kapatın."
echo "═══════════════════════════════════════════"
