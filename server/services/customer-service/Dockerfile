FROM node:24-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
COPY server/src/package.json server/src/package.json
COPY server/services/gateway/package.json server/services/gateway/package.json
COPY server/services/admin-service/package.json server/services/admin-service/package.json
COPY server/services/store-service/package.json server/services/store-service/package.json
COPY server/services/courier-service/package.json server/services/courier-service/package.json
COPY server/services/customer-service/package.json server/services/customer-service/package.json
COPY server/prisma/schema.prisma server/prisma/schema.prisma

RUN npm ci

FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/server/package.json ./server/package.json
COPY --from=deps /app/server/src/package.json ./server/src/package.json
COPY --from=deps /app/server/services/customer-service/package.json ./server/services/customer-service/package.json
COPY server/src ./server/src
COPY server/prisma ./server/prisma
COPY server/services/customer-service ./server/services/customer-service

WORKDIR /app/server/services/customer-service
EXPOSE 3104
CMD ["node", "main.js"]
