FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/client/package.json apps/client/
COPY apps/server/package.json apps/server/
COPY packages/protocol/package.json packages/protocol/
RUN npm install
COPY . .
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3001
CMD ["npm","start","-w","@rift/server"]
