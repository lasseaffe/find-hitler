# Find Hitler — Next.js 16 + custom Socket.io server (server.js).
# Portable image for Render / Fly.io / any container host. Binds $PORT.
FROM node:22-slim AS base
WORKDIR /app

# Install ALL deps (devDeps needed for `next build`). postinstall runs `prisma generate`.
COPY package.json package-lock.json ./
RUN npm ci

# Build
COPY . .
RUN npm run build

# Runtime
ENV NODE_ENV=production
ENV PORT=3004
EXPOSE 3004
CMD ["node", "server.js"]
