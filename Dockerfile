# Serve the static Tic-Tac-Toe PWA with nginx (HTTP + HTTPS)
FROM nginx:1.27-alpine

# Install openssl for self-signed certificate generation
RUN apk add --no-cache openssl

# Remove default nginx static content and config
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf

# Copy app files into the nginx serve directory
COPY index.html    /usr/share/nginx/html/
COPY app.js        /usr/share/nginx/html/
COPY styles.css    /usr/share/nginx/html/
COPY sw.js         /usr/share/nginx/html/
COPY manifest.json /usr/share/nginx/html/
COPY icons/        /usr/share/nginx/html/icons/

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Generate a self-signed certificate valid for 10 years.
# CN/SAN are set to "test.pwa" so hostname validation matches that domain.
RUN mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -nodes -newkey rsa:2048 \
      -days 3650 \
      -keyout /etc/nginx/ssl/selfsigned.key \
      -out    /etc/nginx/ssl/selfsigned.crt \
      -subj   "/C=US/ST=Local/L=Local/O=TicTacToe/CN=test.pwa" \
      -addext "subjectAltName=DNS:test.pwa,DNS:localhost,IP:127.0.0.1"

# Expose HTTP and HTTPS ports
EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
