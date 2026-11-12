import sys
import time
from pathlib import Path

import yaml
from fastapi.testclient import TestClient

from projectos_agent.config import Settings
from projectos_agent.main import create_app

FIX = Path(__file__).parent / "fixtures"


def make(tmp_path, dev=True, team=""):
    (tmp_path / "docs").mkdir()
    (tmp_path / "docs" / "shot.png").write_bytes(b"\x89PNG\r\n\x1a\n")
    (tmp_path / "README.md").write_text("# Hello")
    (tmp_path / "secret.txt").write_text("nope")
    reg = {"projects": [{"id": "job", "name": "Job", "type": "job", "working_directory": str(tmp_path), "launch": {"executable": sys.executable, "args": [str(FIX / "fake_job.py")]}}]}
    rp = tmp_path / "registry.yaml"
    rp.write_text(yaml.safe_dump(reg))
    s = Settings(registry_path=rp, log_dir=tmp_path / "logs", audit_path=tmp_path / "logs/audit.jsonl", dev_allow_local=dev, access_team_domain=team, access_aud=["aud"] if team else [])
    return create_app(s)


def test_requires_access_token(tmp_path):
    with TestClient(make(tmp_path, dev=False)) as c:
        assert c.get("/api/projects").status_code == 401
        r = c.get("/api/projects", headers={"Cf-Access-Jwt-Assertion": "x"})
        assert r.status_code == 503  # Access not configured: refuse rather than allow


def test_flow_and_files(tmp_path):
    with TestClient(make(tmp_path)) as c:
        info = c.get("/api/agent").json()
        assert info["mode"] == "live"
        assert c.get("/api/projects").json()["projects"][0]["id"] == "job"
        assert c.post("/api/projects/nope/start").status_code == 404
        assert c.post("/api/projects/job/start").status_code == 200
        for _ in range(50):
            st = c.get("/api/projects/job").json()["runtime"]["status"]
            if st == "stopped":
                break
            time.sleep(0.1)
        assert st == "stopped"
        assert any("Done" in l["text"] for l in c.get("/api/projects/job/logs").json()["lines"])
        assert c.get("/api/projects/job/readme").text == "# Hello"
        assert c.get("/api/projects/job/media/shot.png").status_code == 200
        assert c.get("/api/projects/job/media/../secret.txt").status_code == 404
        assert c.get("/api/projects/job/media/..%2Fsecret.txt").status_code == 404
        acts = c.get("/api/activity").json()["items"]
        assert any(a["project"] == "job" for a in acts)
        assert "cpu" in c.get("/api/host/metrics").json()


def test_valid_access_jwt_accepted_wrong_aud_rejected(tmp_path):
    import jwt as pyjwt
    from cryptography.hazmat.primitives.asymmetric import rsa

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    app = make(tmp_path, dev=False, team="team.cloudflareaccess.com")

    class K:
        def __init__(self, k):
            self.key = k

    with TestClient(app) as c:
        guard = [d for r in app.routes if getattr(r, "path", "") == "/api/agent" for d in r.dependant.dependencies][0].call
        guard._jwks.get_signing_key_from_jwt = lambda t: K(key.public_key())
        now = int(time.time())
        good = pyjwt.encode({"aud": ["aud"], "iss": "https://team.cloudflareaccess.com", "email": "me@example.com", "iat": now, "exp": now + 300}, key, algorithm="RS256")
        bad = pyjwt.encode({"aud": ["other"], "iss": "https://team.cloudflareaccess.com", "iat": now, "exp": now + 300}, key, algorithm="RS256")
        assert c.get("/api/agent", headers={"Cf-Access-Jwt-Assertion": good}).status_code == 200
        assert c.get("/api/agent", headers={"Cf-Access-Jwt-Assertion": bad}).status_code == 403
