# Rift Hunters: Dual Frequency

Web-based asymmetric AR co-op game. A laptop displays the webcam battlefield while two phones act as motion blasters.

## Requirements

- Node.js 20+
- Laptop browser with webcam
- Two phones with gyroscope (touch fallback is included)
- HTTPS for motion sensors outside localhost

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173/display` on the laptop. Phones must be able to reach the laptop; for LAN testing use the laptop IP in the QR URL and serve over trusted HTTPS (for example with a local TLS proxy or tunnel).

Server liveness: `http://localhost:3001/health`. Deployment readiness: `http://localhost:3001/ready`.

## Environment

- `VITE_SERVER_URL`: public Socket.IO server URL; omit in local proxy mode.
- `PORT`: server port, default `3001`.
- `CLIENT_ORIGIN`: comma-separated allowed web origins, default `*`.

## Commands

```bash
npm run dev
npm run typecheck
npm test
npm run build
npm start -w @rift/server
```

## Gameplay

1. Display creates a six-character room and QR code.
2. Two phones scan the code and receive Player 1 (red) or Player 2 (cyan).
3. Enable the webcam and motion permission, then recenter each phone.
4. Red and cyan targets must be shot by their matching player.
5. Combo targets require both players. Misses cost 10 points; escaped targets damage the shield.

The server owns room state, target spawning, scoring, hit validation, combo timing, rate limiting, countdown, precise pause/resume, and round completion. Display sessions survive refresh through a session token, controllers can reclaim their player slot, and empty rooms expire after two minutes.

Automated tests cover authoritative scoring and combo rules plus Socket.IO room allocation, display reconnection, capacity, and closure.

The display uses generated Web Audio cues for countdown, shots, hits, misses, combos, breaches, and round completion. No external audio assets are required, and sound can be muted from the display footer.

Each round ends with a server-authoritative mission debrief showing shots, hits, misses, accuracy, and combo contribution for both players.

Round outcome is authoritative: surviving until the timer reaches zero is a victory, while depleted shield is a defeat. The display uses distinct debrief styling, messaging, audio, and structured completion logs for each outcome.

The three-minute round is divided into three waves. Later waves shorten target lifetimes and increase the frequency of cooperative combo targets; the current wave is visible in the display HUD.

The lobby includes a synchronized four-step field tutorial. The display explains shared rules while each phone receives guidance tailored to its player color and controls.

Accepted shots include authoritative impact coordinates. The display renders player-colored beam trails, hit/miss/combo markers, and graded camera shake at the actual aim position.

Each controller has a six-cell magazine. The server consumes ammo only for accepted shots, rejects firing while empty, and validates manual reloads; both the phone meter and laptop HUD stay synchronized.

The laptop owns the webcam-backed AR-style battlefield; phones are motion controllers, not separate AR cameras. After joining, tap `Enable Motion Aim`, grant permission, hold the phone upright, and move it until the live radar dot responds. The same normalized aim drives the laptop crosshair. Mobile motion sensors require HTTPS (plain `http://<laptop-ip>` may connect to the room but expose no sensor data); the on-screen status reports HTTPS, permission, calibration, and missing-sensor failures. Dragging the touch area remains a complete fallback.

After motion controls are enabled, a deliberate phone shake also requests reload. The gesture uses acceleration thresholding and a local cooldown to avoid triggering during normal aiming; the manual button remains available as fallback.

Display and controller clients monitor Socket.IO connectivity. If the transport drops, controls are blocked with a clear offline state; once connected again, each role automatically rejoins the room using its stored token and restores authoritative state without a page refresh.

If either player drops during an active round, the server pauses immediately and records which link was lost. Timer and target expiry stay protected; the display can resume only after both player slots are online again.

All state-changing Socket.IO handlers perform runtime validation for object shape, room/token strings, player identity, and finite numeric inputs before reading or mutating room state. Malformed events are ignored and covered by state-integrity integration tests.

Production lifecycle logs are emitted as one-line JSON for room creation, closure, expiration, and game start. The logger removes tokens, player-token maps, and aim/sensor coordinates, bounds string values, and stays silent during tests unless `TEST_LOGS=1`.

On `SIGTERM` or `SIGINT`, the server marks `/ready` unavailable, stops every room timer, informs and disconnects clients, closes the HTTP listener, and exits. Render uses `/ready` as its health-check path.

## Public deployment

The persistent Socket.IO backend runs at `https://rift-hunters.onrender.com`. Deploy the frontend repository to Vercel using the root `vercel.json`, then set this build-time environment variable for Production, Preview, and Development:

```text
VITE_SERVER_URL=https://rift-hunters.onrender.com
```

After Vercel assigns the final domain, set Render's `CLIENT_ORIGIN` to that exact origin (for example `https://rift-hunters.vercel.app`) and redeploy the backend. The SPA rewrite in `vercel.json` keeps `/display` and `/controller/:room` working on refresh.

Run `npm run smoke:production` to verify Render readiness, WebSocket room creation, P1/P2 allocation, aim propagation, RTT acknowledgement, and room cleanup against production. Physical sensor acceptance still requires the two-phone procedure in `docs/DEVICE_QA.md`.
