# Mobile ngrok dev script

## Current behavior

`npm run dev:mobile` starts Vite on `0.0.0.0:5173`, proxies frontend requests to the local backend, and prints LAN URLs. The launcher builds `allowedHosts` only from localhost and local IP addresses. It also pins Vite origin and HMR to the LAN host.

When the same server is opened through an ngrok HTTPS URL, Vite rejects the request because the generated ngrok hostname is absent from `allowedHosts`. Manually overriding host, origin, protocol, and client port works but is unsuitable for a live demo.

## Root cause and flow

1. `package.json` maps `npm run dev:mobile` to `scripts/start-mobile-dev.mjs`.
2. The script exports mobile development variables and starts Vite.
3. `vite.config.js` consumes those variables to configure `server.allowedHosts`, `server.origin`, HMR, and the same-origin backend proxy.
4. The current host list excludes ngrok domains, while forced LAN origin/HMR values prevent the browser from naturally using the hostname through which it loaded the page.

## Scope

- Allow ngrok free and standard domain suffixes without allowing every arbitrary host.
- Mark the mobile launcher profile so Vite infers the request hostname and protocol instead of forcing LAN origin/HMR.
- Preserve LAN access and all existing proxy routes.
- Keep `npm run dev:mobile` as the only frontend command required on demo day.

## Acceptance criteria

- `npm run dev:mobile` still exposes the frontend over localhost and LAN.
- `ngrok http 5173` can open the same Vite server without a blocked-host response.
- No ngrok hostname needs to be copied into `.env` or PowerShell variables.
- Vite does not pin browser HMR/origin to the LAN IP in the mobile launcher profile.
- `/graphql`, `/api`, `/uploads`, and `/socket.io` continue proxying to the backend on port 4000.
- No secret, ngrok token, fixed tunnel URL, or new dependency is committed.

## Out of scope

- Starting ngrok automatically.
- Managing the ngrok authentication token.
- Publicly tunneling the backend as a separate service.
- Changing production deployment configuration.
