# Build stage
FROM node:26.5.0-alpine3.24@sha256:e88a35be04478413b7c71c455cd9865de9b9360e1f43456be5951032d7ac1a66 AS build-stage
WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY . .

# Pass API base URL into Vite build
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

# Runtime stage
FROM nginxinc/nginx-unprivileged:1.31.3-alpine3.24@sha256:18d67281256ded39ff65e010ae4f831be18f19356f83c60bc546492c7eb6dd23 AS runtime-stage

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build-stage --chown=101:101 /app/dist /usr/share/nginx/html

USER 101:101
EXPOSE 8081

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8081/healthz || exit 1
