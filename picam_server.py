#!/usr/bin/env python3
"""
Raspberry Pi AI Camera (IMX500) → MJPEG HTTP Stream Sunucusu

Kullanım:
  python3 picam_server.py

Bu sunucu aynı zamanda statik dosyaları da sunar (index.html, game.js vs).
Böylece tek bir komutla hem web uygulaması hem de kamera stream'i çalışır.

  http://localhost:8080/          → Kesir Kâşifi uygulaması
  http://localhost:8080/camera    → Canlı MJPEG stream

Chromium ile açmak için:
  chromium --use-fake-ui-for-media-stream http://localhost:8080
"""

import subprocess
import threading
import http.server
import socketserver
import io
import time
import os
import signal
import sys

PORT = 8080
CAMERA_WIDTH = 640
CAMERA_HEIGHT = 480
CAMERA_FPS = 15

# Global: en son JPEG frame
latest_frame = None
frame_lock = threading.Lock()
camera_running = False


def camera_thread():
    """rpicam-vid ile kameradan MJPEG frame'lerini okur."""
    global latest_frame, camera_running

    cmd = [
        "rpicam-vid",
        "--camera", "0",
        "--width", str(CAMERA_WIDTH),
        "--height", str(CAMERA_HEIGHT),
        "--framerate", str(CAMERA_FPS),
        "--codec", "mjpeg",
        "--inline",
        "-t", "0",
        "-o", "-",
    ]

    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        camera_running = True
        print(f"[PiCam] Kamera başlatıldı ({CAMERA_WIDTH}x{CAMERA_HEIGHT} @ {CAMERA_FPS}fps)")

        buf = bytearray()
        while True:
            chunk = proc.stdout.read(4096)
            if not chunk:
                break
            buf.extend(chunk)

            # JPEG frame'leri bul (FFD8 = başlangıç, FFD9 = bitiş)
            while True:
                start = buf.find(b'\xff\xd8')
                end = buf.find(b'\xff\xd9', start + 2) if start >= 0 else -1
                if start < 0 or end < 0:
                    break
                frame = bytes(buf[start:end + 2])
                with frame_lock:
                    latest_frame = frame
                buf = buf[end + 2:]

    except FileNotFoundError:
        print("[PiCam] HATA: rpicam-vid bulunamadı. Raspberry Pi OS'ta olduğunuzdan emin olun.")
        camera_running = False
    except Exception as e:
        print(f"[PiCam] Kamera hatası: {e}")
        camera_running = False


class PiCamHandler(http.server.SimpleHTTPRequestHandler):
    """Statik dosyalar + /camera MJPEG stream endpoint'i."""

    def do_GET(self):
        if self.path == "/camera":
            self.send_mjpeg_stream()
        elif self.path == "/camera/snapshot":
            self.send_snapshot()
        elif self.path == "/camera/status":
            self.send_camera_status()
        else:
            super().do_GET()

    def send_camera_status(self):
        """Kamera durumunu JSON olarak döndürür."""
        import json
        status = {
            "running": camera_running,
            "hasFrame": latest_frame is not None,
            "width": CAMERA_WIDTH,
            "height": CAMERA_HEIGHT,
            "fps": CAMERA_FPS,
        }
        data = json.dumps(status).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def send_snapshot(self):
        """Tek bir JPEG frame döndürür."""
        with frame_lock:
            frame = latest_frame
        if frame is None:
            self.send_error(503, "Kamera henüz hazır değil")
            return
        self.send_response(200)
        self.send_header("Content-Type", "image/jpeg")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(frame)))
        self.end_headers()
        self.wfile.write(frame)

    def send_mjpeg_stream(self):
        """Sürekli MJPEG stream gönderir (multipart/x-mixed-replace)."""
        self.send_response(200)
        self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.end_headers()

        prev_frame = None
        try:
            while True:
                with frame_lock:
                    frame = latest_frame
                if frame is not None and frame is not prev_frame:
                    try:
                        self.wfile.write(b"--frame\r\n")
                        self.wfile.write(b"Content-Type: image/jpeg\r\n")
                        self.wfile.write(f"Content-Length: {len(frame)}\r\n".encode())
                        self.wfile.write(b"\r\n")
                        self.wfile.write(frame)
                        self.wfile.write(b"\r\n")
                        self.wfile.flush()
                        prev_frame = frame
                    except BrokenPipeError:
                        break
                time.sleep(1.0 / (CAMERA_FPS + 5))
        except (ConnectionResetError, BrokenPipeError):
            pass

    def log_message(self, format, *args):
        # MJPEG stream loglarını sustur
        if "/camera" not in (args[0] if args else ""):
            super().log_message(format, *args)


def main():
    # Kamera thread'ini başlat
    cam = threading.Thread(target=camera_thread, daemon=True)
    cam.start()

    # Birkaç saniye bekle, kameranın başlamasını sağla
    time.sleep(1)
    if camera_running:
        print(f"[PiCam] Kamera aktif!")
    else:
        print(f"[PiCam] UYARI: Kamera başlatılamadı. Uygulama kamerasız çalışacak.")

    # HTTP sunucuyu başlat
    handler = PiCamHandler
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        print(f"[PiCam] Sunucu hazır: http://localhost:{PORT}")
        print(f"[PiCam] Kamera stream:  http://localhost:{PORT}/camera")
        print(f"[PiCam] Chromium ile aç:")
        print(f"  chromium --use-fake-ui-for-media-stream http://localhost:{PORT}")
        print()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[PiCam] Sunucu durduruluyor...")
            httpd.shutdown()


if __name__ == "__main__":
    main()
