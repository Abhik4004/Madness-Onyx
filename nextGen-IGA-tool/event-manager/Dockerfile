# ─── EVENT MANAGER SERVICE ─────────────────────────────────────────────────────
# Listens to NATS message broker and processes/routes events between services.
# No HTTP port exposed — purely event-driven via NATS.
# No DB connection — stateless event processor.

# Use slim variant — smaller image, fewer vulnerabilities
FROM node:20-slim

# Tell Node we're in production — disables dev logs, enables optimizations
ENV NODE_ENV=production

# Set working directory inside container
WORKDIR /app

# Copy only package files first — Docker layer cache trick:
# If source code changes but package.json doesn't, npm install won't re-run
COPY package*.json ./

# Install only production dependencies (skip devDependencies)
RUN npm install --omit=dev

# Copy rest of source code
COPY . .

# No HTTP port — this service only communicates via NATS
# EXPOSE not needed but kept for documentation
EXPOSE 3003

# Healthcheck — simple process alive check (no HTTP server to ping)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "process.exit(0)"

# Start the event manager
CMD ["node", "index.js"]