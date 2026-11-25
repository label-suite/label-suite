"""CI-only ASGI app that reports the client address and scheme the server sees.

compose.override.yml mounts this file into the backend container and runs it with
the image's own uvicorn, replacing the real app, so a request through Nginx shows
what the backend would see after uvicorn's proxy-header handling (#566, design D4).
It answers 200 with a JSON body on every path, including /api/v1/health, so the
backend health check passes and `up --wait` succeeds. It is never part of the
image or of the default orchestration.
"""

import json


async def app(scope, receive, send):
    """Serve the lifespan protocol and answer every HTTP request with client and scheme."""
    if scope["type"] == "lifespan":
        while True:
            message = await receive()
            if message["type"] == "lifespan.startup":
                await send({"type": "lifespan.startup.complete"})
            elif message["type"] == "lifespan.shutdown":
                await send({"type": "lifespan.shutdown.complete"})
                return
    if scope["type"] != "http":
        return
    client = scope.get("client")
    body = json.dumps(
        {"client": client[0] if client else None, "scheme": scope["scheme"]}
    ).encode()
    await send(
        {
            "type": "http.response.start",
            "status": 200,
            "headers": [(b"content-type", b"application/json")],
        }
    )
    await send({"type": "http.response.body", "body": body})
