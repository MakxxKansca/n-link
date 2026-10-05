# -*- coding: utf-8 -*-
import http.server
import socketserver
import webbrowser
import os
import sys
import json

PORT = 5173
DIST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dist')

class COOPHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIST_DIR, **kwargs)

    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/log':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8', errors='replace')
            log_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'debug_usb.log')
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(body + '\n')
            try:
                data = json.loads(body)
                logs = data.get('logs', [])
                print(f"\n--- [TELEMETRÍA USB RECIBIDA: {len(logs)} eventos] ---")
                for l in logs[-10:]:
                    print(f"[{l.get('time')}] {l.get('cmd')}: {l.get('result')} | {l.get('details')}")
                if data.get('lastError'):
                    print(f"Último error: {data.get('lastError')}")
                print("-" * 50)
            except Exception:
                print(f"[RAW LOG] {body[:200]}")
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
            return
        super().do_POST()

def main():
    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(('127.0.0.1', PORT), COOPHandler) as httpd:
            url = f'http://localhost:{PORT}'
            print('=' * 55)
            print(f' Servidor n-Link Web activo en: {url}')
            print(' Abriendo en tu navegador Chromium (Chrome / Edge)...')
            print(' Presiona Ctrl+C para detener.')
            print('=' * 55)
            webbrowser.open(url)
            httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nServidor detenido.')

if __name__ == '__main__':
    main()
