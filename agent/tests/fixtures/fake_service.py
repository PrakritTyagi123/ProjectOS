"""A pretend backend: boots slowly, spawns a child, answers /health on a port."""
import http.server
import subprocess
import sys
import threading
import time

port = int(sys.argv[1])
delay = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
print("Loading config", flush=True)
child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(600)"])  # must die with the tree
print(f"child pid {child.pid}", flush=True)
time.sleep(delay)
print("token=supersecretvalue123 should be redacted", flush=True)


class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200 if self.path == "/health" else 404)
        self.end_headers()
        self.wfile.write(b"ok")

    def log_message(self, *a):
        print("GET", self.path, flush=True)


srv = http.server.HTTPServer(("127.0.0.1", port), H)
print(f"Listening on 127.0.0.1:{port}", flush=True)
srv.serve_forever()
