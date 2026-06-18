# Multi-stage build for the Trainova Next.js app.
# Produces a small standalone runtime image served by a non-root user.

# ---- deps: install dependencies with pnpm ----------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- builder: compile the Next.js standalone bundle ------------------------
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable

# NEXT_PUBLIC_* is baked at build time. "1" enables the login UI in the client;
# the actual database connection is a runtime env (DATABASE_URL) on the server.
ARG NEXT_PUBLIC_AUTH_ENABLED
ENV NEXT_PUBLIC_AUTH_ENABLED=$NEXT_PUBLIC_AUTH_ENABLED
ARG NEXT_PUBLIC_AI_ENABLED
ENV NEXT_PUBLIC_AI_ENABLED=$NEXT_PUBLIC_AI_ENABLED
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ---- runner: minimal production image --------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user (matches the convention across the other projects).
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# The standalone output bundles a server.js plus the minimal node_modules.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]
