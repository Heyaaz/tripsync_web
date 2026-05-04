# Next.js 프론트엔드 Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV NEXT_PUBLIC_API_URL=http://server:8080
ENV PORT=3001

EXPOSE 3001

CMD ["npm", "run", "dev"]
