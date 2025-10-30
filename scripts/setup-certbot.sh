#!/bin/bash

set -e

chmod +x scripts/certbot-init.sh
chmod +x scripts/certbot-renew.sh

CRON_JOB="0 2 * * * cd $(pwd) && ./scripts/certbot-renew.sh >> /var/log/certbot-renew.log 2>&1"

(crontab -l 2>/dev/null | grep -v "certbot-renew.sh") | crontab -
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "A renewal check runs automatically at 2:00 AM daily"
echo "Check renewal logs: tail -f /var/log/certbot-renew.log"