FROM node:22-alpine

WORKDIR /app

# Install the frontend's locked dependencies before copying the changing source.
COPY backoffice/package.json backoffice/package-lock.json ./
RUN npm ci

COPY backoffice/ ./
COPY start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh

EXPOSE 3000

CMD ["/usr/local/bin/start.sh"]
