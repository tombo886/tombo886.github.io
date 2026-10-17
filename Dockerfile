FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY data ./data
COPY public ./public
EXPOSE 8080
CMD ["node", "server.js"]
