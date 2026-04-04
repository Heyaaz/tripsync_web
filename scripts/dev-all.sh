#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$ROOT_DIR"
SERVER_DIR="$(cd "$ROOT_DIR/../tmti_server" && pwd)"

MYSQL_CONTAINER="${MYSQL_CONTAINER:-tripsync-mysql}"
MYSQL_IMAGE="${MYSQL_IMAGE:-mysql:8}"
MYSQL_PORT="${MYSQL_PORT:-3307}"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-root}"
MYSQL_DATABASE="${MYSQL_DATABASE:-tripsync}"
MYSQL_USER="${MYSQL_USER:-tripsync}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-tripsync123}"
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
      echo "[db] Stopping MySQL container '$MYSQL_CONTAINER'"
      docker stop "$MYSQL_CONTAINER" >/dev/null 2>&1 || true
    else
      echo "[db] Leaving MySQL container '$MYSQL_CONTAINER' running"
    fi
  fi

  exit "$exit_code"
}

trap 'cleanup 130' INT
trap 'cleanup 143' TERM
trap 'cleanup $?' EXIT

require_command() {
  local command_name="$1"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
}

ensure_mysql() {
  if docker ps --format '{{.Names}}' | grep -Fxq "$MYSQL_CONTAINER"; then
    echo "[db] MySQL container '$MYSQL_CONTAINER' is already running"
    return
  fi

  if docker ps -a --format '{{.Names}}' | grep -Fxq "$MYSQL_CONTAINER"; then
    echo "[db] Starting existing MySQL container '$MYSQL_CONTAINER'"
    docker start "$MYSQL_CONTAINER" >/dev/null
    STARTED_DB=1
    return
  fi

  echo "[db] Creating MySQL container '$MYSQL_CONTAINER' on port $MYSQL_PORT"
  docker run -d \
    --name "$MYSQL_CONTAINER" \
    -e MYSQL_ROOT_PASSWORD="$MYSQL_ROOT_PASSWORD" \
    -e MYSQL_DATABASE="$MYSQL_DATABASE" \
    -e MYSQL_USER="$MYSQL_USER" \
    -e MYSQL_PASSWORD="$MYSQL_PASSWORD" \
    -p "$MYSQL_PORT:3306" \
    -v tripsync-mysql-data:/var/lib/mysql \
    "$MYSQL_IMAGE" >/dev/null
  STARTED_DB=1
}

resolve_mysql_port() {
  local mapped_port

  mapped_port="$(docker port "$MYSQL_CONTAINER" 3306/tcp 2>/dev/null | awk -F: 'END {print $NF}')"

  if [[ -n "$mapped_port" ]]; then
    MYSQL_PORT="$mapped_port"
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

if [[ ! -d "$SERVER_DIR" ]]; then
  echo "Missing server directory: $SERVER_DIR" >&2
  exit 1
fi

ensure_mysql
resolve_mysql_port

echo "[stack] web=http://localhost:3001 server=http://localhost:3000 db=mysql://localhost:$MYSQL_PORT"

start_in_dir "server" "$SERVER_DIR" npm run start:dev
start_in_dir "web" "$WEB_DIR" npm run dev

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
