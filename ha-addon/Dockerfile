ARG BUILD_FROM
FROM ${BUILD_FROM}

# Install Node.js 20
RUN apk add --no-cache nodejs npm python3 make g++

WORKDIR /app

# Copy app
COPY . .

# Install and build
RUN npm ci && npm run build && npm prune --production

# Data dir (mapped to HA config)
RUN mkdir -p /data/knowledge-curator

# Use /data for persistent storage (HA maps this)
ENV NODE_ENV=production
ENV DATA_DIR=/data/knowledge-curator
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

CMD ["npm", "start"]
