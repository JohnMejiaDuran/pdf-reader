"""Reject unauthorized/oversized requests before FastAPI parses multipart bodies."""
import hmac
from fastapi import HTTPException
from starlette.responses import JSONResponse


class IngressGuard:
    def __init__(self, app, settings):
        self.app, self.settings = app, settings

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["path"] == "/health":
            await self.app(scope, receive, send)
            return
        headers = dict(scope.get("headers", []))
        expected = f"Bearer {self.settings.api_token}".encode()
        if not self.settings.api_token:
            await JSONResponse({"detail": "Configurá API_TOKEN en el servidor."}, 503)(scope, receive, send)
            return
        if not hmac.compare_digest(headers.get(b"authorization", b""), expected):
            await JSONResponse({"detail": "Token del servidor inválido."}, 401)(scope, receive, send)
            return
        # Allow bounded multipart framing in addition to the exact per-file limit.
        limit = self.settings.max_upload_mb * 1024 * 1024 + 65536 if scope["path"] == "/jobs" else 256 * 1024
        if b"content-length" in headers:
            try:
                length = int(headers[b"content-length"])
                if length < 0:
                    raise ValueError()
            except ValueError:
                await JSONResponse({"detail": "Content-Length inválido."}, 400)(scope, receive, send)
                return
            if length > limit:
                await JSONResponse({"detail": "La petición supera el tamaño permitido."}, 413)(scope, receive, send)
                return
        consumed = 0

        async def bounded_receive():
            nonlocal consumed
            message = await receive()
            consumed += len(message.get("body", b""))
            if consumed > limit:
                # Raised inside FastAPI's body reader; its exception handler returns 413.
                raise HTTPException(413, "La petición supera el tamaño permitido.")
            return message

        await self.app(scope, bounded_receive, send)
