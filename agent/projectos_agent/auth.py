"""Cloudflare Access: every request must carry a valid Cf-Access-Jwt-Assertion.

The agent checks the token itself even though the tunnel sits behind Access, so a
mis-configured tunnel route can't expose it. Keys come from the team's JWKS endpoint.
"""
from __future__ import annotations

import time

import jwt
from fastapi import HTTPException, Request
from jwt import PyJWKClient


class AccessGuard:
    def __init__(self, settings):
        self.s = settings
        self._jwks: PyJWKClient | None = None
        if settings.access_team_domain:
            self._jwks = PyJWKClient(f"https://{settings.access_team_domain}/cdn-cgi/access/certs", cache_keys=True, lifespan=3600)
        self.issuer = f"https://{settings.access_team_domain}" if settings.access_team_domain else None

    def configured(self) -> bool:
        return bool(self._jwks and self.s.access_aud)

    def __call__(self, request: Request) -> dict:
        token = request.headers.get("cf-access-jwt-assertion")
        client = request.client.host if request.client else ""
        if not token:
            if self.s.dev_allow_local and client in ("127.0.0.1", "::1", "testclient"):
                return {"sub": "local-dev", "email": "local"}
            raise HTTPException(401, "Missing Cloudflare Access token")
        if not self.configured():
            raise HTTPException(503, "Access is not configured on the agent (access_team_domain, access_aud)")
        try:
            key = self._jwks.get_signing_key_from_jwt(token).key
            claims = jwt.decode(token, key, algorithms=["RS256"], audience=self.s.access_aud, issuer=self.issuer, leeway=30)
        except Exception as e:
            raise HTTPException(403, f"Invalid Access token: {type(e).__name__}") from e
        return claims


class RateLimit:
    """Simple per-identity budget for actions that change state."""

    def __init__(self, per_min: int):
        self.per_min = per_min
        self.hits: dict[str, list[float]] = {}

    def check(self, who: str) -> None:
        now = time.time()
        h = [t for t in self.hits.get(who, []) if now - t < 60]
        if len(h) >= self.per_min:
            raise HTTPException(429, "Too many actions. Try again in a minute.")
        h.append(now)
        self.hits[who] = h
