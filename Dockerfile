# ------------ build stage ------------
FROM node:20-slim AS builder
WORKDIR /app

# Install dependencies based on lock-file
# Ensure native modules like sqlite3 build from source
ENV npm_config_build_from_source=true
COPY package*.json ./
# Install build tools for native addon compilation, install deps, then rebuild sqlite3 from source for glibc compatibility
RUN apt-get update && apt-get install -y --no-install-recommends python3 build-essential \
    && npm ci --omit=dev \
    && npm rebuild sqlite3 --build-from-source \
    && apt-get purge -y build-essential python3 \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# Copy source and build Next.js
COPY . .
RUN npm run build

# ------------ runtime stage ------------
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production

# Copy built files and node_modules from builder stage
COPY --from=builder /app /app

# Ensure SQLite data folder exists (will be replaced by Fly volume)
RUN mkdir -p server/data

# Fly sets $PORT, default to 3001 for local run
EXPOSE 3001

CMD ["node", "server/server.js"]
