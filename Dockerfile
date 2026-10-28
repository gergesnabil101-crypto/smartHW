# SmartHW — Cloud Run image. Builds the Vite frontend and runs the Express server
# with Node's native TypeScript support (same entrypoint as AI Studio: `node server.ts`).
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
COPY server.ts ./
COPY server ./server
COPY src/utils ./src/utils
COPY firebase-applet-config.json metadata.json ./
EXPOSE 8080
ENV PORT=8080
CMD ["node", "server.ts"]
