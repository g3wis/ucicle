#!/bin/sh
# Schedule of the Index data jobs (container `jobs`, deploy/docker-compose.yml). No cron daemon: one
# shell loop, so the jobs run as the container's user with the container's environment.
#
# 1. At start: `yarn migrate`. A failure stops the container, which Docker restarts.
# 2. Every day at NIGHTLY_AT (wall clock of TZ, Europe/Paris by default), in sequence:
#      yarn collect --recent COLLECT_RECENT_DAYS
#      yarn enrich:wikidata                     only on WEEKLY_DAY (1 = Monday ... 7 = Sunday)
#      yarn rate                                run even if the collect failed (it rates what is stored)
#    then, if `rate` succeeded, asks nginx to clear its proxy cache (deploy/nginx/50-ucicle-cache-purge.sh).
#
# The day of the last nightly run is kept in STATE_DIR (volume jobs_data). A run missed because the
# container was down at NIGHTLY_AT is run when it comes back the same day; the first start on an empty
# volume after NIGHTLY_AT does not catch up (the first full collect is run by hand: deploy/README.md).
set -u

NIGHTLY_AT="${NIGHTLY_AT:-04:00}"
WEEKLY_DAY="${WEEKLY_DAY:-7}"
COLLECT_RECENT_DAYS="${COLLECT_RECENT_DAYS:-14}"
STATE_DIR="${STATE_DIR:-/data/scheduler}"
SIGNAL_FILE="${SIGNAL_FILE:-/var/run/ucicle-signal/purge-cache}"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S %Z') [scheduler] $*"; }

case "$NIGHTLY_AT" in
  [01][0-9]:[0-5][0-9] | 2[0-3]:[0-5][0-9]) ;;
  *) log "NIGHTLY_AT must be HH:MM (got '$NIGHTLY_AT')"; exit 1 ;;
esac
case "$WEEKLY_DAY" in
  [1-7]) ;;
  *) log "WEEKLY_DAY must be 1 (Monday) to 7 (Sunday) (got '$WEEKLY_DAY')"; exit 1 ;;
esac

# "1HHMM" compares as a decimal number, whatever the leading zeros.
TARGET="1$(echo "$NIGHTLY_AT" | tr -d ':')"
now_hhmm() { echo "1$(date +%H%M)"; }

job() {
  log "start: yarn $*"
  started=$(date +%s)
  yarn --silent "$@"
  code=$?
  log "end: yarn $* (exit $code, $(( $(date +%s) - started )) s)"
  return "$code"
}

nightly() {
  log "nightly run of $1"
  job collect --recent "$COLLECT_RECENT_DAYS" || log "collect failed: the index is recomputed on the data already stored"
  if [ "$(date +%u)" = "$WEEKLY_DAY" ]; then
    job enrich:wikidata || log "enrich:wikidata failed"
  fi
  if job rate; then
    if : > "$SIGNAL_FILE" 2>/dev/null; then
      log "proxy cache purge requested"
    else
      log "cannot write $SIGNAL_FILE: the proxy cache keeps its pages until they expire"
    fi
  else
    log "rate failed: the site keeps serving the previous index"
  fi
  log "nightly run of $1 done"
}

mkdir -p "$STATE_DIR"
STAMP="$STATE_DIR/last-nightly"

job migrate || { log "migrations failed: exiting"; exit 1; }

if [ ! -s "$STAMP" ]; then
  if [ "$(now_hhmm)" -ge "$TARGET" ]; then date +%F > "$STAMP"; else echo none > "$STAMP"; fi
fi
log "nightly sequence at $NIGHTLY_AT (${TZ:-UTC}), enrich:wikidata on day $WEEKLY_DAY; last run: $(cat "$STAMP")"

while :; do
  today=$(date +%F)
  if [ "$(cat "$STAMP")" != "$today" ] && [ "$(now_hhmm)" -ge "$TARGET" ]; then
    # Written before the run: a run that crashes the container is not started again in a loop.
    echo "$today" > "$STAMP"
    nightly "$today"
  fi
  sleep 60
done
