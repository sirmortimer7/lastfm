"""Minimal static server for Last.fm dashboard."""
import http.server
import os

PORT = int(os.environ.get("PORT", 8080))

print(f"Serving Last.fm dashboard at http://localhost:{PORT}")
http.server.HTTPServer(("", PORT), http.server.SimpleHTTPRequestHandler).serve_forever()
