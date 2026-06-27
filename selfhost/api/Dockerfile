FROM node:22-alpine

RUN apk add --no-cache wget

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --production --ignore-scripts 2>/dev/null || npm install --production

COPY src/ ./src/

ENV NODE_ENV=production
EXPOSE 3001

USER node
CMD ["node", "src/index.js"]
