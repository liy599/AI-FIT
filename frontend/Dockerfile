FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* /app/
RUN npm ci

COPY . /app

ARG VITE_API_BASE=/api
ENV VITE_API_BASE=$VITE_API_BASE

RUN npm run build

FROM nginx:1.27-alpine

RUN apk add --no-cache openssl

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.d/40-generate-self-signed-cert.sh /docker-entrypoint.d/40-generate-self-signed-cert.sh
RUN chmod +x /docker-entrypoint.d/40-generate-self-signed-cert.sh
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80 443
