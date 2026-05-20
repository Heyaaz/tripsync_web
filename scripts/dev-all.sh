#!/usr/bin/env bash

set -euo pipefail

WEB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_DIR="$(cd "$WEB_DIR/.." && pwd)"
SERVER_DIR="$ROOT_DIR/tmti_server"
LEGACY_ENV_FILE="$ROOT_DIR/tmti_server/.env"

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-tripsync-postgres}"
POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:15-alpine}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-tripsync}"
POSTGRES_USER="${POSTGRES_USER:-tripsync}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-tripsync}"
STOP_DB_ON_EXIT="${STOP_DB_ON_EXIT:-0}"
STARTED_DB=0
SHUTTING_DOWN=0

PIDS=()
PGIDS=()

cleanup() {
  local exit_code="${1:-$?}"
  if [[ "$SHUTTING_DOWN" == "1" ]]; then
    return
  fi
  SHUTTING_DOWN=1
  trap - EXIT INT TERM
  echo "[stack] Shutting down"

  for pgid in "${PGIDS[@]:-}"; do
    if [[ -n "$pgid" ]]; then
      kill -INT -- "-$pgid" 2>/dev/null || true
    fi
  done
  sleep 1
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -TERM "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  done

  if command -v docker >/dev/null 2>&1; then
    if [[ "$STOP_DB_ON_EXIT" == "1" || "$STARTED_DB" == "1" ]]; then
      echo "[db] Stopping PostgreSQL container '$POSTGRES_CONTAINER'"
      docker stop "$POSTGRES_CONTAINER" >/dev/null 2>&1 || true
    else
      echo "[db] Leaving PostgreSQL container '$POSTGRES_CONTAINER' running"
    fi
  fi
  exit "$exit_code"
}

trap 'cleanup 130' INT
trap 'cleanup 143' TERM
trap 'cleanup $?' EXIT

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

ensure_postgres() {
  if docker ps --format '{{.Names}}' | grep -Fxq "$POSTGRES_CONTAINER"; then
    echo "[db] PostgreSQL container '$POSTGRES_CONTAINER' is already running"
    return
  fi
  if docker ps -a --format '{{.Names}}' | grep -Fxq "$POSTGRES_CONTAINER"; then
    echo "[db] Starting existing PostgreSQL container '$POSTGRES_CONTAINER'"
    docker start "$POSTGRES_CONTAINER" >/dev/null
    STARTED_DB=1
    return
  fi

  echo "[db] Creating PostgreSQL container '$POSTGRES_CONTAINER' on port $POSTGRES_PORT"
  docker run -d \
    --name "$POSTGRES_CONTAINER" \
    -e POSTGRES_DB="$POSTGRES_DB" \
    -e POSTGRES_USER="$POSTGRES_USER" \
    -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    -p "$POSTGRES_PORT:5432" \
    -v tripsync-postgres-data:/var/lib/postgresql/data \
    "$POSTGRES_IMAGE" >/dev/null
  STARTED_DB=1
}

resolve_postgres_port() {
  local mapped_port
  mapped_port="$(docker port "$POSTGRES_CONTAINER" 5432/tcp 2>/dev/null | awk -F: 'END {print $NF}')"
  if [[ -n "$mapped_port" ]]; then
    POSTGRES_PORT="$mapped_port"
  fi
}

start_in_dir() {
  local label="$1"
  local dir="$2"
  shift 2
  (
    cd "$dir"
    echo "[$label] Starting in $dir"
    exec "$@"
  ) &
  local pid="$!"
  local pgid
  pgid="$(ps -o pgid= -p "$pid" | tr -d ' ')"
  PIDS+=("$pid")
  PGIDS+=("$pgid")
}

require_command docker
require_command npm

if [[ -f "$LEGACY_ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$LEGACY_ENV_FILE"
  set +a
fi

if [[ ! -d "$SERVER_DIR" ]]; then
  echo "Missing Spring server directory: $SERVER_DIR" >&2
  exit 1
fi

ensure_postgres
resolve_postgres_port

echo "[stack] web=http://localhost:3001 server=http://localhost:8080 db=postgres://localhost:$POSTGRES_PORT/$POSTGRES_DB"

start_in_dir "server" "$SERVER_DIR" env \
  SPRING_PROFILES_ACTIVE=local \
  SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:$POSTGRES_PORT/$POSTGRES_DB" \
  SPRING_DATASOURCE_USERNAME="$POSTGRES_USER" \
  SPRING_DATASOURCE_PASSWORD="$POSTGRES_PASSWORD" \
  API_BASE_URL="http://localhost:8080/api" \
  FRONTEND_BASE_URL="http://localhost:3001" \
  OAUTH_CALLBACK_BASE_URL="http://localhost:8080" \
  TOURAPI_KEY="${TOURAPI_KEY:-${TOUR_API_SERVICE_KEY:-}}" \
  ./gradlew bootRun
start_in_dir "web" "$WEB_DIR" env NEXT_PUBLIC_API_URL="http://localhost:8080" npm run dev

while true; do
  for pid in "${PIDS[@]}"; do
    if ! kill -0 "$pid" 2>/dev/null; then
      wait "$pid" || true
      echo "[stack] A process exited. Stopping the remaining services." >&2
      exit 1
    fi
  done
  sleep 2
done
