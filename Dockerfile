# --- Stage 1: Build dashboard (Vite/React) ---
FROM node:22-alpine AS dashboard-build

WORKDIR /app/dashboard
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci
COPY dashboard/ ./
COPY shared/ /app/shared/
RUN npm run build

# --- Stage 2: Build CLI/server (tsup) ---
FROM node:22-alpine AS server-build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsup.config.ts tsconfig.json ./
COPY src/ src/
COPY shared/ shared/
COPY --from=dashboard-build /app/dist/dashboard dist/dashboard/
RUN npm run build:cli

# Prune devDependencies for a lean production image
RUN npm prune --omit=dev

# --- Stage 3: Production runtime ---
FROM node:22-alpine

RUN apk add --no-cache tini

WORKDIR /app

COPY --from=server-build /app/dist dist/
COPY --from=server-build /app/node_modules node_modules/
COPY --from=server-build /app/package.json package.json

RUN addgroup -S ghmonit && adduser -S ghmonit -G ghmonit
RUN mkdir -p /data && chown ghmonit:ghmonit /data
USER ghmonit

ENV NODE_ENV=production
ENV GH_MONIT_DB_PATH=/data/gh-monit.db

EXPOSE 3847

ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/index.js", "dashboard", "--db", "/data/gh-monit.db", "--no-open"]
