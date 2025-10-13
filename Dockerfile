# Stage 1: Builder
FROM node:20-bullseye AS builder
WORKDIR /app

# Copy package files for caching
COPY package*.json ./
RUN npm ci --no-audit --prefer-offline

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:20-bullseye-slim
WORKDIR /app

ENV NODE_ENV=production

# Copy built artifacts
COPY --from=builder /app/dist ./dist
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev --no-audit

# Run as non-root user
USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:5000/api/metrics', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "dist/index.js"]
