FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

FROM base AS builder
RUN npm ci
COPY . .

FROM base AS runner
ENV NODE_ENV=production
RUN npm ci --omit=dev && addgroup -S app && adduser -S app -G app
COPY --from=builder /app/app.js ./app.js
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/constants ./constants
COPY --from=builder /app/controllers ./controllers
COPY --from=builder /app/db ./db
COPY --from=builder /app/db/init.js ./db/init.js
COPY --from=builder /app/repositories ./repositories
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/schemas ./schemas
COPY --from=builder /app/services ./services
COPY --from=builder /app/src ./src
COPY --from=builder /app/utils ./utils
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/data ./data
COPY --from=builder /app/uploads ./uploads
USER app
EXPOSE 3000
CMD ["npm", "run", "start"]