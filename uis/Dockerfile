FROM node:22-alpine

WORKDIR /app

# Install the frontend's locked dependencies before copying the changing source.
COPY talent-pipeline-tracker/package.json talent-pipeline-tracker/package-lock.json ./
RUN npm ci

COPY talent-pipeline-tracker/ ./
COPY start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh

EXPOSE 3000

CMD ["/usr/local/bin/start.sh"]
