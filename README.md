# Easy Bracket

A simple, self-hosted tool for running a **single-elimination tournament** from start to finish.

Built for one-off, in-person events: no accounts and no ceremony — open it, add teams, generate a
bracket, and start entering scores. Players can follow along on a public, read-only bracket page.

## Features

- **No login** — the app opens straight into your tournaments.
- **Guided setup wizard**: add teams → add courts → generate the bracket.
- **Any number of teams** (5, 11, 13, …): the bracket is padded to the next power of two with
  **standard seeding**, and byes go only to the top seeds in round 1 — no team ever skips ahead.
- **Drag-to-arrange seeding board** with a live bracket preview: use Standard seeding, Randomize,
  or drag any team into any spot.
- **Simple scoring**: enter the score, pick the winner, and the winner advances automatically.
- **Live planning board**: matches spread across your courts, each with a clear status
  (Up next / Playing now / Final); finished matches drop into a Completed queue.
- **Public bracket page** for players, with a 🏆 champion banner once the final is decided.

## Requirements

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose.
- Your user must be able to run Docker — either add it to the `docker` group
  (`sudo usermod -aG docker $USER`, then log out/in) or prefix the commands below with `sudo`.

## Run it

```bash
git clone git@github.com:SrBlank/simple-bracket.git
cd simple-bracket
docker compose up -d --build
```

Then open **http://localhost:8400**.

The image is built from this repository (so your local changes are included) and a Postgres
container is started alongside it. The app signs in automatically as the organizer — there is no
login page. The first boot may take a minute while the database initializes.

To stop:

```bash
docker compose down
```

To wipe all data and start fresh:

```bash
docker compose down -v
```

## Running a tournament

1. On the home page, click **Create Tournament**.
2. **Setup** wizard: add your teams, add your courts, then generate the bracket.
3. **Seeding** (optional): drag teams to arrange the bracket, or use **Standard seeding** /
   **Randomize**, then **Generate bracket**.
4. **Planning**: press **Schedule** to lay the matches out on the courts.
5. As games finish, open a match, enter the score and pick the winner — they advance automatically,
   and the match moves to the **Completed** queue.
6. Share the public bracket with players: it's at
   `/tournaments/<dashboard-link>/dashboard/bracket` (a QR code is shown on the dashboard).

## Configuration

The backend is configured with environment variables — see `docker-compose.yml` (e.g. `PG_DSN`,
`CORS_ORIGINS`, `SERVE_FRONTEND`).

The organizer account that the app auto-signs-in as is seeded on first boot from `ADMIN_EMAIL` /
`ADMIN_PASSWORD` (defaults live in `backend/bracket/config.py`). The frontend signs in with those
credentials; you can override them with the `VITE_ORGANIZER_EMAIL` / `VITE_ORGANIZER_PASSWORD`
build-time variables.

## Development

**Backend** (Python, [FastAPI](https://fastapi.tiangolo.com)) — uses [`uv`](https://docs.astral.sh/uv/):

```bash
cd backend
uv sync
uv run pytest tests/unit_tests/        # run unit tests
```

**Frontend** ([Vite](https://vite.dev/) + React + [Mantine](https://mantine.dev/)) — uses
[`pnpm`](https://pnpm.io/):

```bash
cd frontend
pnpm install
pnpm exec tsc --noEmit                  # typecheck
VITE_API_BASE_URL=http://localhost:8400/api pnpm exec vite build   # production build
```

A running Postgres instance is needed for the full backend; the Docker Compose setup provides one.

## Credits

Easy Bracket is based on [Bracket](https://github.com/evroon/bracket) by Erik Vroon and
contributors, trimmed down and reworked for single-use, single-elimination tournaments.

## License

Licensed under [AGPL-3.0](https://choosealicense.com/licenses/agpl-3.0/), the same license as the
project it is based on. See [LICENSE](LICENSE).
