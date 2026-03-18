# Serve the static Tic-Tac-Toe PWA with nginx (HTTP only)
FROM nginx:1.27-alpine

# Remove default nginx static content and config
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf

# Copy app files into the nginx serve directory
COPY index.html    /usr/share/nginx/html/
COPY app.js        /usr/share/nginx/html/
COPY styles.css    /usr/share/nginx/html/
COPY sw.js         /usr/share/nginx/html/
COPY manifest.json /usr/share/nginx/html/
COPY icons/        /usr/share/nginx/html/icons/

# Copy custom nginx configuration (HTTP only)
COPY nginx.conf /etc/nginx/nginx.conf

# Expose HTTP port only
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
