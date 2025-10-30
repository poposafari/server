#!/bin/bash

set -e

DOMAIN=poposafari.net

mkdir -p certbot/www
mkdir -p certbot/conf

docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --agree-tos \
  --no-eff-email \
  -d $DOMAIN \
  -d www.$DOMAIN

echo "SSL certificate successfully issued"
