# ─── FRONTEND SERVICE ──────────────────────────────────────────────────────────
# React/Vite SPA served via Nginx.
# IMPORTANT: Vite bakes env vars into the bundle at BUILD TIME, not runtime.
# So VITE_API_BASE_URL must be passed as a Docker build ARG, not just env var.
# Served on port 80.

# ── Stage 1: Build ──────────────────────────────────────────────────────────────
# Use full node image to compile the Vite app
FROM node:20-slim AS build

WORKDIR /app

# Copy only package files first — Docker layer cache trick:
# If source code changes but package.json doesn't, npm install won't re-run
COPY package*.json ./

# Install ALL dependencies (including devDeps — needed for Vite build)
RUN npm install

# Copy rest of source code
COPY . .

# CRITICAL: Declare build argument — passed in from docker-compose build.args
ARG VITE_API_BASE_URL=http://localhost:3000

# Expose as env var so Vite picks it up during `npm run build`
# Without this, VITE_API_BASE_URL is undefined in the bundle → API calls fail
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Build the production bundle — VITE_API_BASE_URL is now baked into /app/dist
RUN npm run build

# ── Stage 2: Serve ──────────────────────────────────────────────────────────────
# Use lightweight Nginx to serve the static files
# Final image has no Node, no source code — just built assets
FROM nginx:alpine

# Copy built assets from stage 1 into Nginx's serving directory
COPY --from=build /app/dist /usr/share/nginx/html

# Custom Nginx config:
# try_files handles SPA routing — deep links like /dashboard don't 404
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Serve on port 80
EXPOSE 80

# Start Nginx in foreground (daemon off = required for Docker)
CMD ["nginx", "-g", "daemon off;"]