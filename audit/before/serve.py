import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[2]
PUBLIC_DIRECTORIES = (ROOT / "uis/website", ROOT / "uis/backoffice", ROOT / "uis/application")
PUBLIC_FILES = {ROOT / name for name in ("application.html", "i18n.js", "validation.js")}


class AuditHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        if urlsplit(self.path).path == "/":
            self.send_response(302)
            self.send_header("Location", "/uis/website/")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return None
        target = Path(self.translate_path(self.path)).resolve()
        allowed = target in PUBLIC_FILES or any(
            target == directory or directory in target.parents
            for directory in PUBLIC_DIRECTORIES
        )
        if not allowed or any(part.startswith(".") for part in target.relative_to(ROOT).parts):
            self.send_error(404)
            return None
        return super().send_head()

    def list_directory(self, path):
        self.send_error(404)
        return None


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    arguments = parser.parse_args()
    handler = partial(AuditHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", arguments.port), handler)
    print(f"Audit server: http://127.0.0.1:{arguments.port}", flush=True)
    server.serve_forever()