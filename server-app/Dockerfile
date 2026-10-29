# --- install dependencies ---
FROM node:20-alpine AS deps
WORKDIR /app

# Only copy manifest files first so this layer is cached unless deps change
COPY package*.json ./
# install only fresh packages with versions in package.lock
RUN npm ci --omit=dev

# --- runtime image ---
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

# Reuse installed node_modules from the deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY server.js ./

# Run as a non-root user (node:20-alpine ships a built-in 'node' user)
USER node

EXPOSE 3000


CMD ["node", "server.js"]