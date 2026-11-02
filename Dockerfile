# ---------- Stage 1: build the web client ----------
FROM node:22-bookworm AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---------- Stage 2: runtime ----------
FROM node:22-bookworm
WORKDIR /app

# System libs needed by puppeteer's bundled Chromium (PDF features)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2 libpango-1.0-0 libcairo2 fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=false

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm install tsx --no-save
COPY --from=build /app/dist ./dist
COPY server.ts ./
COPY server ./server
COPY firebase-applet-config.json ./
COPY data ./data

EXPOSE 8080
CMD ["npx", "tsx", "server.ts"]
