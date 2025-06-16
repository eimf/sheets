# ------------ build stage ------------
FROM node:20-slim AS builder
WORKDIR /app

# Install dependencies based on lock-file
COPY package*.json ./
RUN npm ci --omit=dev

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
