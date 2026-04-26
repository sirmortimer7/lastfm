#!/bin/bash
# Last.fm dashboard — startup script
cd "$(dirname "$0")"
echo "Starting Last.fm dashboard..."
echo "Open http://localhost:8080 in your browser"
echo ""
/usr/bin/python3 server.py
