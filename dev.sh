#!/bin/bash
#
# Local development without a full Docker build.
#
# This runs *only* Postgres in a container and then starts the backend and frontend directly on
# the host with hot-reload, so you don't have to rebuild the Docker image to test a change. For
# production, keep using `docker compose up -d --build` (see README).
#
# Requirements on the host: docker, uv (backend), pnpm (frontend).
#
set -eo pipefail

DB_CONTAINER=bracket-dev-db
DB_IMAGE=${DB_IMAGE:-postgres:16}
DB_USER=bracket_dev
DB_PASSWORD=bracket_dev
DB_NAME=bracket_dev
DB_PORT=${DB_PORT:-5432}

export ENVIRONMENT=DEVELOPMENT
export PG_DSN="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${DB_PORT}/${DB_NAME}"

# Allow `docker` to work whether or not the user is in the docker group.
DOCKER="docker"
if ! docker info >/dev/null 2>&1; then
  DOCKER="sudo docker"
fi

start_postgres() {
  local running existing
  running=$($DOCKER ps -q -f "name=^/${DB_CONTAINER}$")
  if [ -n "${running}" ]; then
    echo "Postgres container '${DB_CONTAINER}' already running."
    return
  fi

  # A stopped container is removed and recreated rather than restarted: the data lives in the
  # named volume, so this is safe and means a crashed container never gets re-run in a broken state.
  existing=$($DOCKER ps -aq -f "name=^/${DB_CONTAINER}$")
  if [ -n "${existing}" ]; then
    $DOCKER rm -f "${DB_CONTAINER}" >/dev/null
  fi

  echo "Creating Postgres container '${DB_CONTAINER}' (${DB_IMAGE}) on port ${DB_PORT}..."
  $DOCKER run -d \
    --name "${DB_CONTAINER}" \
    -e POSTGRES_USER="${DB_USER}" \
    -e POSTGRES_PASSWORD="${DB_PASSWORD}" \
    -e POSTGRES_DB="${DB_NAME}" \
    -p "${DB_PORT}:5432" \
    -v bracket_dev_pg_data:/var/lib/postgresql/data \
    "${DB_IMAGE}" >/dev/null

  echo -n "Waiting for Postgres to accept connections"
  local attempts=0
  until $DOCKER exec "${DB_CONTAINER}" pg_isready -U "${DB_USER}" >/dev/null 2>&1; do
    # Bail out (with logs) if the container died, or after ~30s, instead of waiting forever.
    if [ -z "$($DOCKER ps -q -f "name=^/${DB_CONTAINER}$")" ] || [ "${attempts}" -ge 60 ]; then
      echo ""
      echo "Postgres did not become ready. Container logs:"
      $DOCKER logs --tail 30 "${DB_CONTAINER}" || true
      echo ""
      echo "If this is a stale data volume, reset it with:"
      echo "  ${DOCKER} rm -f ${DB_CONTAINER} && ${DOCKER} volume rm bracket_dev_pg_data"
      exit 1
    fi
    attempts=$((attempts + 1))
    echo -n "."
    sleep 0.5
  done
  echo " ready at ${PG_DSN}"
}

run_frontend() {
  cd frontend && pnpm run dev
}

run_backend() {
  cd backend && ENVIRONMENT=DEVELOPMENT PG_DSN="${PG_DSN}" uv run gunicorn \
    -k bracket.uvicorn.RestartableUvicornWorker \
    bracket.app:app \
    --bind localhost:8400 \
    --workers 1 \
    --reload
}

start_postgres

echo "Backend:  http://localhost:8400"
echo "Frontend: http://localhost:5173  (Vite default)"
echo "Stop the app with Ctrl-C; stop the database with: ${DOCKER} stop ${DB_CONTAINER}"

(trap 'kill 0' SIGINT
  run_frontend &
  run_backend
)
