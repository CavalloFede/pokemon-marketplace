# Stage 1: Build
FROM node:20-alpine AS builder

# Install pnpm and openssl
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
RUN apk add --no-cache openssl

WORKDIR /app

# Copy ALL workspace files first
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/api ./apps/api

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client
WORKDIR /app/apps/api
RUN npx prisma generate

# Build shared package (if it has a build script)
WORKDIR /app/packages/shared
RUN npm run build 2>/dev/null || echo "No build script in shared"

# Build API
WORKDIR /app/apps/api
RUN pnpm build

# Stage 2: Production
FROM node:20-alpine AS runner

# Install openssl for Prisma
RUN apk add --no-cache openssl

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 api

WORKDIR /app

# Copy workspace structure
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/package.json ./

# Set working directory to api
WORKDIR /app/apps/api

# Change ownership
RUN chown -R api:nodejs /app

USER api

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "dist/server.js"]
