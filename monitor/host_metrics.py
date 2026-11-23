#!/usr/bin/env python3
"""Opt-in system metrics endpoint for MathGenius admin-health.
Run only on a server you own. Bind loopback and proxy through private HTTPS.
Requires: python -m pip install psutil

METRICS_TOKEN: strong random token (>=24 characters)
METRICS_BIND: default 127.0.0.1
METRICS_PORT: default 8765
"""
import hmac
import json
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import psutil

token = os.environ.get("METRICS_TOKEN", "")
if len(token) < 24:
    raise SystemExit("METRICS_TOKEN must be at least 24 characters.")
host = os.environ.get("METRICS_BIND", "127.0.0.1")
port = int(os.environ.get("METRICS_PORT", "8765"))
if host not in ("127.0.0.1", "::1"):
    raise SystemExit("Bind to loopback only; use an authenticated HTTPS proxy.")

psutil.cpu_percent(interval=None)


class Handler(BaseHTTPRequestHandler):
    last_net = None
    last_at = None

    def log_message(self, *_args):
        # Do not emit client IP addresses or authorization headers to logs.
        pass

    def send_json(self, code, body):
        encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self):
        if self.path != "/metrics":
            self.send_json(404, {"error": "not found"})
            return
        authorization = self.headers.get("Authorization", "")
        expected = "Bearer " + token
        if not hmac.compare_digest(authorization, expected):
            self.send_json(403, {"error": "forbidden"})
            return
        try:
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage("/")
            now = time.monotonic()
            network = psutil.net_io_counters()
            previous = Handler.last_net
            elapsed = now - Handler.last_at if Handler.last_at is not None else 0
            Handler.last_net = network
            Handler.last_at = now
            receive = max(0.0, (network.bytes_recv - previous.bytes_recv) / elapsed) if previous and elapsed > 0 else None
            transmit = max(0.0, (network.bytes_sent - previous.bytes_sent) / elapsed) if previous and elapsed > 0 else None
            self.send_json(200, {
                "cpu_pct": round(psutil.cpu_percent(interval=None), 1),
                "memory_used_bytes": memory.used,
                "memory_total_bytes": memory.total,
                "disk_used_bytes": disk.used,
                "disk_total_bytes": disk.total,
                "network_rx_bytes_per_sec": receive,
                "network_tx_bytes_per_sec": transmit,
                "uptime_seconds": int(time.time() - psutil.boot_time()),
            })
        except Exception:
            self.send_json(503, {"error": "metrics temporarily unavailable"})


if __name__ == "__main__":
    print(f"Local metrics agent listening on {host}:{port} (authenticated /metrics)")
    ThreadingHTTPServer((host, port), Handler).serve_forever()
