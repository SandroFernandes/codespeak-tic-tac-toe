# Tic‑Tac‑Toe (HTTP + Tailscale)

Human vs HAL (minimax + alpha‑beta) as a lightweight PWA served by nginx in Docker. The app runs over HTTP locally and can be shared across your tailnet using Tailscale. No custom HTTPS or local domain is required.

## Quick Start
- Build and run: `docker compose up -d`
- Open: `http://localhost:8080`
- Stop: `docker compose down`

## Share via Tailscale
You have two easy options. Either access from another device on your tailnet using your node’s MagicDNS name or IP, or use Tailscale’s Serve/Funnel features.

- Tailnet access (no extra config): from another device on your tailnet, visit
  `http://<your-node-magicdns>:8080` (or `http://<tailscale-ip>:8080`).
- Optional Serve/Funnel: if you enable Tailscale Serve/Funnel for port 8080, you may get an HTTPS URL. The app works fine either way; this repo does not configure TLS itself.

Tip: when running tests against a non‑localhost URL, set `BASE_URL` to the address reachable from your test runner (examples below).

## Tests
This repo includes reachability checks and UI automation (Puppeteer).

- Local tests (localhost):
  - `./test.sh`
- Remote tests (e.g., via Tailscale):
  - `BASE_URL=http://<your-node-magicdns>:8080 ./test.sh`

What the tests do:
- Verify Docker is running for this project
- Verify the HTTP endpoint responds (uses `BASE_URL` or defaults to `http://localhost:8080`)
- Run UI tests: page loads, title, 9 cells, initial status, scores, overlay hidden, X→O gameplay

Node is required for UI tests (Puppeteer). The script auto‑installs Puppeteer into `ui-test-deps/` on first run.

## Configuration
- Container ports: `docker-compose.yml` maps host `8080` → container `80`.
- Test environment variables:
  - `BASE_URL`: Full URL for tests (e.g., `http://localhost:8080`, or your MagicDNS URL).
  - `LOCALHOST_HOST`/`LOCALHOST_PORT`: Optional overrides for the UI test default (`localhost:8080`).

## Notes on PWA/Service Worker
- Service workers require a secure context (HTTPS) except on `localhost`. The app registers its service worker automatically; on non‑secure origins the browser may decline to activate it. The game still works normally over plain HTTP.
- If you enable Tailscale Serve/Funnel to provide HTTPS, the service worker will activate on that URL as well.

## Project Layout
- `index.html` – UI shell
- `styles.css` – platform‑adaptive styles (Android/Windows/macOS look)
- `app.js` – game logic + minimax + UI handlers + SW registration
- `sw.js` – cache‑first app‑shell service worker
- `Dockerfile`, `nginx.conf`, `docker-compose.yml` – HTTP‑only static serving
- `test.sh` – smoke + UI tests harness
- `ui-test.mjs` – Puppeteer UI tests (copied into `ui-test-deps/` at runtime)
- `spec/main.cs.md` – CodeSpeak spec

## Common Commands
- Rebuild after changes: `docker compose build --no-cache && docker compose up -d`
- Tail logs: `docker compose logs -f`
- Prune old images/containers (careful): `docker system prune`

Enjoy, and ping me if you want the service‑worker registration gated on secure context to keep the console extra clean for non‑localhost HTTP.
