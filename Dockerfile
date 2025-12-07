# Этап сборки
FROM node:18-alpine as build-stage
WORKDIR /app

# Копируем package.json
COPY package*.json ./
RUN npm install

# Копируем исходники
COPY . .

# Аргумент для передачи URL при сборке (значение по умолчанию)
ARG VITE_API_BASE_URL=https://hack.eferzo.xyz
# Превращаем ARG в ENV, чтобы Vite его увидел
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# Этап production
FROM nginx:stable-alpine as production-stage
COPY --from=build-stage /app/dist /usr/share/nginx/html
# Копируем исправленный конфиг
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]