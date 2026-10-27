FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/app/data
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
VOLUME ["/app/data"]
EXPOSE 8092
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8092/healthz || exit 1
CMD ["node", "server.js"]
