# ─── GATEWAY SERVICE ───────────────────────────────────────────────────────────
# Entry point for all client requests.
# Routes traffic to access-management (3001) and recommendation (3002).
# Connects to MySQL DB and external auth service.
# Runs on port 3000.

# Use slim variant — smaller image, fewer vulnerabilities
FROM node:20-slim

# Tell Node/Express we're in production — disables dev logs, enables optimizations
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

# Document which port this service listens on
EXPOSE 3000

# Healthcheck — Docker uses this to know if container is alive
# Hits /health every 30s, marks unhealthy after 3 consecutive failures
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the gateway server
CMD ["node", "src/app.js"]