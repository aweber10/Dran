# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM alpine:3.21
ARG PB_VERSION=0.40.2
ARG TARGETARCH
RUN apk add --no-cache ca-certificates tzdata unzip wget \
  && BUILD_ARCH="${TARGETARCH:-$(uname -m)}" \
  && case "$BUILD_ARCH" in amd64|x86_64) PB_ARCH=amd64 ;; arm64|aarch64) PB_ARCH=arm64 ;; *) echo "Unsupported architecture: $BUILD_ARCH"; exit 1 ;; esac \
  && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${PB_ARCH}.zip" \
  && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_checksums.txt" \
  && grep "pocketbase_${PB_VERSION}_linux_${PB_ARCH}.zip" "pocketbase_${PB_VERSION}_checksums.txt" | sha256sum -c - \
  && unzip "pocketbase_${PB_VERSION}_linux_${PB_ARCH}.zip" pocketbase -d /pb \
  && rm "pocketbase_${PB_VERSION}_linux_${PB_ARCH}.zip" "pocketbase_${PB_VERSION}_checksums.txt"

WORKDIR /pb
COPY --from=web /app/pb_public ./pb_public
COPY pb_migrations ./pb_migrations
COPY pb_hooks ./pb_hooks
VOLUME ["/pb/pb_data"]
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8090/api/health || exit 1
ENTRYPOINT ["/pb/pocketbase"]
CMD ["serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--publicDir=/pb/pb_public", "--hooksDir=/pb/pb_hooks", "--migrationsDir=/pb/pb_migrations"]
