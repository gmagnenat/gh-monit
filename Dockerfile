# --- Stage 1: Build dashboard (Vite/React) ---
FROM node:22-alpine AS dashboard-build

RUN corepack enable && corepack prepare pnpm@11.2.2 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY dashboard/package.json dashboard/
RUN pnpm install --frozen-lockfile --filter gh-monit-dashboard
COPY dashboard/ dashboard/
COPY shared/ shared/
RUN pnpm --filter gh-monit-dashboard run build

# --- Stage 2: Build CLI/server (tsup) ---
FROM node:22-alpine AS server-build

RUN corepack enable && corepack prepare pnpm@11.2.2 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY dashboard/package.json dashboard/
RUN pnpm install --frozen-lockfile --filter gh-monit
COPY tsup.config.ts tsconfig.json ./
COPY src/ src/
COPY shared/ shared/
COPY --from=dashboard-build /app/dist/dashboard dist/dashboard/
RUN pnpm run build:cli

# Prune devDependencies for a lean production image
RUN CI=true pnpm prune --prod

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
