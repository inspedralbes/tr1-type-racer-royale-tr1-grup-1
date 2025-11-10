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

# Copiamos los archivos generados por el build
COPY --from=builder /app/dist/ /usr/local/apache2/htdocs/

# Creamos el archivo .htaccess con el contenido necesario
RUN echo '<IfModule mod_negotiation.c>\n\
  Options -MultiViews\n\
</IfModule>\n\
\n\
<IfModule mod_rewrite.c>\n\
  RewriteEngine On\n\
  RewriteBase /\n\
  RewriteRule ^index\\.html$ - [L]\n\
  RewriteCond %{REQUEST_FILENAME} !-f\n\
  RewriteCond %{REQUEST_FILENAME} !-d\n\
  RewriteRule . /index.html [L]\n\
</IfModule>' > /usr/local/apache2/htdocs/.htaccess

# Habilitamos mod_rewrite y aseguramos que Apache lo use
RUN sed -i '/LoadModule rewrite_module/s/^#//g' /usr/local/apache2/conf/httpd.conf && \
    sed -i '/<Directory "\/usr\/local\/apache2\/htdocs">/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/' /usr/local/apache2/conf/httpd.conf

EXPOSE 80
CMD ["httpd-foreground"]