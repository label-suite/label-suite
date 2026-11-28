# syntax=docker/dockerfile:1

# Backend image. One image serves the API, the one-off migration service and,
# later, the Celery worker (ADR-008 D2). Two stages, so the runtime layer carries
# neither uv nor any build cache (system-design component list, this file's row).

# --- builder: turn the locked dependencies into a standalone virtualenv --------
FROM python:3.12-slim@sha256:5b5fe805d367f8f5a359ded6ab2652b7f9a206453ee6ee789c0045ba6ec15016 AS builder

# uv is pinned and copied from its own image. Never pip install (Hard Rule 3).
COPY --from=ghcr.io/astral-sh/uv:0.12.18 /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_NO_CACHE=1 \
    UV_PYTHON=/usr/local/bin/python3.12 \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv

WORKDIR /src

# Only the lock inputs, so changing app code does not reinstall dependencies.
COPY pyproject.toml uv.lock ./

# --locked fails instead of rewriting uv.lock; --no-dev leaves the test and lint
# tools out of the image; --no-install-project keeps this layer free of app/.
RUN uv sync --locked --no-dev --no-install-project

# --- runtime ------------------------------------------------------------------
FROM python:3.12-slim@sha256:5b5fe805d367f8f5a359ded6ab2652b7f9a206453ee6ee789c0045ba6ec15016 AS runtime

ENV PATH=/opt/venv/bin:$PATH \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

# The process never runs as root. /app/data is created here and owned by the app
# user so that the Lite-tier named volume mounted there inherits that ownership
# and SQLite can write to it (system-design D3).
RUN groupadd --gid 10001 app \
    && useradd --uid 10001 --gid 10001 --home-dir /home/app --create-home app \
    && install -d -o app -g app /app/data

COPY --from=builder /opt/venv /opt/venv

WORKDIR /app

# pyproject.toml has to sit next to the app package: get_app_version reads
# [project].version from it while the app is assembled (app/core/openapi.py).
COPY --chown=app:app pyproject.toml alembic.ini ./
COPY --chown=app:app app ./app
COPY --chown=app:app alembic ./alembic

USER app

EXPOSE 8000

# The container health check calls this image's own Python against /api/v1/health,
# because the slim base has no curl (system-design D5).
CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
