# ─── ACCESS MANAGEMENT SERVICE ─────────────────────────────────────────────────
# Handles user access, roles, and permissions.
# Called internally by gateway via http://access-management:3001.
# Connects to MySQL DB and listens on NATS for events.
# Runs on port 3001.

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
RUN npm install 

# Copy rest of source code
COPY . .

# Document which port this service listens on
EXPOSE 3001

# Healthcheck — Docker uses this to know if container is alive
# Hits /health every 30s, marks unhealthy after 3 consecutive failures
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', r => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the access management server
CMD ["node", "src/index.js"]