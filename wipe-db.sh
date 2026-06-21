#!/bin/bash
#
# Wipe the local development database.
#
# Removes the dev Postgres container and its data volume so the next `./dev.sh` recreates an empty
# database (the backend re-creates the schema and seeds the admin user + default club on first
# boot). Use this after schema changes when you don't want to run a migration by hand.
#
# This DELETES ALL local dev data (tournaments, teams, results). It does not touch production.
#
set -eo pipefail

DB_CONTAINER=${DB_CONTAINER:-bracket-dev-db}
DB_VOLUME=${DB_VOLUME:-bracket_dev_pg_data}

# Allow `docker` to work whether or not the user is in the docker group (mirrors dev.sh).
DOCKER="docker"
if ! docker info >/dev/null 2>&1; then
  DOCKER="sudo docker"
fi

if [ "$1" != "-y" ] && [ "$1" != "--yes" ]; then
  echo "This will permanently delete the local dev database:"
  echo "  container: ${DB_CONTAINER}"
  echo "  volume:    ${DB_VOLUME}"
  echo ""
  read -r -p "Continue? [y/N] " reply
  case "${reply}" in
    [yY] | [yY][eE][sS]) ;;
    *)
      echo "Aborted."
      exit 1
      ;;
  esac
fi

# Stop and remove the container if it exists (ignore if it doesn't).
if [ -n "$($DOCKER ps -aq -f "name=^/${DB_CONTAINER}$")" ]; then
  echo "Removing container '${DB_CONTAINER}'..."
  $DOCKER rm -f "${DB_CONTAINER}" >/dev/null
else
  echo "No container '${DB_CONTAINER}' to remove."
fi

# Remove the data volume if it exists.
if $DOCKER volume inspect "${DB_VOLUME}" >/dev/null 2>&1; then
  echo "Removing volume '${DB_VOLUME}'..."
  $DOCKER volume rm "${DB_VOLUME}" >/dev/null
else
  echo "No volume '${DB_VOLUME}' to remove."
fi

echo ""
echo "Done. Run ./dev.sh to recreate a fresh database."
