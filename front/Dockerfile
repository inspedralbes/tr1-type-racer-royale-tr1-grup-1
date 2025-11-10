# ETAPA 1: Construcción (Node.js)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Definimos la variable de entorno directamente en la ejecución del build.
# Esto asegura que Vite lea la variable VITE_URL_BACK con la IP correcta.
RUN cp .env.PROD .env && npm run build

# ETAPA 2: Servir (Apache)
FROM httpd:2.4-alpine
# Copia los archivos de la carpeta 'dist' generados en la Etapa 1
COPY --from=builder /app/dist/ /usr/local/apache2/htdocs/