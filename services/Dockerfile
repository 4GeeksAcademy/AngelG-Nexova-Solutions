FROM python:3.12-slim

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:${PATH}"

WORKDIR /workspace

RUN pip install --no-cache-dir uv

# Keep the manifest and lockfile together for a reproducible, locked install.
COPY api/pyproject.toml api/uv.lock ./services/api/
WORKDIR /workspace/services/api
RUN uv sync --locked --no-dev --no-install-project

COPY api/ ./
RUN mkdir -p /workspace/packages/shared
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
