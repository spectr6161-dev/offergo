FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

RUN chown -R node:node /app
USER node

EXPOSE 8080
CMD ["node", "./dist/server/entry.mjs"]
