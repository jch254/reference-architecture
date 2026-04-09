FROM --platform=linux/amd64 public.ecr.aws/docker/library/node:24-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@9

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

FROM --platform=linux/amd64 public.ecr.aws/docker/library/node:24-alpine AS production

WORKDIR /app

RUN npm install -g pnpm@9

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist

RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001
RUN chown -R appuser:nodejs /app
USER appuser

EXPOSE 3000

CMD ["node", "dist/main.js"]
