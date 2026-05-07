#!/usr/bin/env bash
set -euo pipefail
PREV=${1:-$(cat ~/.poposafari-previous-sha)}
echo "Rolling back to $PREV"
./scripts/deploy.sh "$PREV"