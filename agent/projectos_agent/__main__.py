"""python -m projectos_agent  [--config agent.yaml]"""
import argparse

import uvicorn

from .config import load_settings
from .main import create_app


def main() -> None:
    ap = argparse.ArgumentParser(prog="projectos_agent")
    ap.add_argument("--config", default=None, help="path to agent.yaml")
    a = ap.parse_args()
    s = load_settings(a.config)
    if s.host not in ("127.0.0.1", "::1", "localhost"):
        raise SystemExit("Refusing to listen on a public interface. Keep host at 127.0.0.1; cloudflared connects locally.")
    uvicorn.run(create_app(s), host=s.host, port=s.port, log_level="info", proxy_headers=False)


if __name__ == "__main__":
    main()
