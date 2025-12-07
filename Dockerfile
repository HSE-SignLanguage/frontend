# Build stage
FROM node:18-alpine AS build-stage
WORKDIR /app

COPY package*.json ./
RUN npm install
COPY . .

# Pass API base URL into Vite build
ARG VITE_API_BASE_URL=https://hack.eferzo.xyz/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# Runtime stage without nginx
FROM node:18-alpine AS runtime-stage
WORKDIR /app

# Static file server
RUN npm install -g serve

# Default runtime port (can be overridden with PORT env)
ENV PORT=8081

COPY --from=build-stage /app/dist ./dist

EXPOSE 8081
CMD ["sh", "-c", "serve -s dist -l tcp://0.0.0.0:${PORT:-8081}"]
