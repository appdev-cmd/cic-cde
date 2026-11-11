FROM node:24-bookworm-slim AS frontend
WORKDIR /src
RUN npm install --global pnpm@10.28.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/desktop/package.json apps/desktop/package.json
RUN pnpm install --frozen-lockfile
COPY apps/desktop apps/desktop
ENV VITE_QABIM_API_BASE=/api
RUN pnpm build

FROM rust:1.93-bookworm AS core
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY crates crates
COPY apps/desktop/src-tauri apps/desktop/src-tauri
RUN --mount=type=cache,id=qabim-cargo-registry,target=/usr/local/cargo/registry,sharing=locked \
    --mount=type=cache,id=qabim-cargo-target,target=/src/target,sharing=locked \
    CARGO_BUILD_JOBS=1 cargo build --locked --release -p qabim-host --bin qabim-local \
    && cp /src/target/release/qabim-local /tmp/qabim-local

FROM python:3.12-slim-bookworm AS api
WORKDIR /app
RUN pip install --no-cache-dir ifcopenshell==0.8.5 \
    && mkdir -p /app/.local/uploads \
    && chown -R 10001:10001 /app/.local
COPY --from=core /tmp/qabim-local /usr/local/bin/qabim-local
COPY workers/bim/src workers/bim/src
COPY apps/desktop/public apps/desktop/public
COPY tests/fixtures/synthetic/riverside-demo.ifc tests/fixtures/synthetic/riverside-demo.ifc
ENV QABIM_ROOT=/app QABIM_PYTHON=python3 PYTHONDONTWRITEBYTECODE=1
USER 10001:10001
CMD ["qabim-local"]

FROM nginx:1.28-alpine AS web
COPY --from=frontend /src/apps/desktop/dist /usr/share/nginx/html
COPY deploy/cong-bao/nginx.conf /etc/nginx/conf.d/default.conf
