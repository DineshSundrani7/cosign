FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY tsconfig.json ./
ENV PORT=8787 COSIGN_DB=/data/cosign.db
RUN mkdir -p /data
EXPOSE 8787
CMD ["npm", "start"]
