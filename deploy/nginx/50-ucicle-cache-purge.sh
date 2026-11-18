#!/bin/sh
# Run by the nginx image's entrypoint (/docker-entrypoint.d/) before nginx starts.
# Starts a background watcher that clears the proxy cache when the nightly job of the `jobs`
# container asks for it, after `yarn rate` (deploy/jobs/scheduler.sh touches the signal file in the
# volume cache_signal). The jobs run as a non-root user and cannot delete nginx's cache files
# themselves; this watcher runs as root in the nginx container.
set -eu

SIGNAL_DIR=/var/run/ucicle-signal
CACHE_DIR=/var/cache/nginx/ucicle

mkdir -p "$SIGNAL_DIR" "$CACHE_DIR"
# uid 1000 = user `node` of the jobs image.
chown 1000:1000 "$SIGNAL_DIR"

(
  while :; do
    if [ -e "$SIGNAL_DIR/purge-cache" ]; then
      rm -f "$SIGNAL_DIR/purge-cache"
      find "$CACHE_DIR" -type f -delete 2>/dev/null || true
      echo "$(date '+%Y-%m-%d %H:%M:%S %Z') [cache-purge] proxy cache cleared"
    fi
    sleep 30
  done
) </dev/null >/proc/1/fd/1 2>/proc/1/fd/2 &

echo "$0: proxy cache purge watcher started"
