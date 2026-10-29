# --- shared base ---
FROM node:20-alpine AS base

WORKDIR /app

COPY package*.json ./

# --- production deps only ---
FROM base AS deps-prod

RUN npm ci --omit=dev

# --- development: all deps (incl. pino-pretty), NODE_ENV=development ---
FROM base AS development

ENV NODE_ENV=development \
    PORT=3000

RUN npm ci

COPY server.js ./

USER node

EXPOSE 3000

CMD ["node", "server.js"]


# --- production: must stay LAST so it is the default target ---
FROM base AS production

ENV NODE_ENV=production \
    PORT=3000

COPY --from=deps-prod /app/node_modules ./node_modules

COPY server.js ./

USER node

EXPOSE 3000

CMD ["node", "server.js"]