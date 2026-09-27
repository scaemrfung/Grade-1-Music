#!/bin/sh
# Bake the "Updated … MT" stamp: sets SITE_UPDATED in updated-stamp.js to the current time (UTC).
# Run just before committing:  sh tools/bake-updated.sh && git add updated-stamp.js
cd "$(dirname "$0")/.." || exit 1
now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
sed -E "s/(SITE_UPDATED = \")[^\"]*(\")/\1$now\2/" updated-stamp.js > updated-stamp.js.tmp && mv updated-stamp.js.tmp updated-stamp.js
grep -q "SITE_UPDATED = \"$now\"" updated-stamp.js && echo "Stamp baked: $now"
