# Multi-stage build for Knowledge Curator
# Supports ARM64 (Raspberry Pi 4) and AMD64

FROM node:20-slim AS base
WORKDIR /app

# Install dependencies for better-sqlite3 native build
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Build
FROM base AS builder
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Skip PWA in production build for server-only usage
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create data directory
RUN mkdir -p /app/data /app/data/pdfs

# Copy built app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/src/lib/pdf/render.cjs ./src/lib/pdf/render.cjs
COPY --from=builder /app/src/lib/pdf/render-transcript.cjs ./src/lib/pdf/render-transcript.cjs

# Data volume for persistent storage (DB, PDFs)
VOLUME /app/data

EXPOSE 3000

CMD ["npm", "start"]
