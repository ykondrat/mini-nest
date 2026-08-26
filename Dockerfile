FROM node:22-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src ./src
COPY test ./test

RUN npm run build

FROM builder AS dev

RUN chown -R node:node /app/dist

USER node

CMD ["npm", "run", "dev:server"]

FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder /app/dist ./dist

USER node

CMD ["npm", "test"]
