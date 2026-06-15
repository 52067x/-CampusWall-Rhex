# Uni-app WeChat Mini Program Guide

The mini program lives in:

```powershell
apps\campus-wall-miniapp
```

It talks to the Rhex web/API server through `apps\campus-wall-miniapp\src\api\request.js`.

Default local API behavior:

```text
H5 preview: same-origin /api proxy from http://localhost:3001 to http://127.0.0.1:3000
WeChat mini program: http://localhost:3000
```

Backend and mini program preview ports are separate:

- Backend/API: `http://localhost:3000`
- H5 preview, if used: starts from `http://localhost:3001`
- WeChat mini program (`mp-weixin`): no HTTP preview port; open the generated files in WeChat DevTools.

## 1. Start Backend First

From the repository root:

```powershell
corepack pnpm run doctor
corepack pnpm run setup
corepack pnpm run dev
```

Verify:

```text
http://localhost:3000
```

## 2. Install Mini Program Dependencies

From the mini program directory:

```powershell
cd apps\campus-wall-miniapp
corepack pnpm install
```

## 3. Run WeChat Mini Program Build

Development build:

```powershell
corepack pnpm run dev:mp-weixin
```

Production build:

```powershell
corepack pnpm run build:mp-weixin
```

The generated WeChat mini program output is normally under:

```text
apps\campus-wall-miniapp\dist\dev\mp-weixin
apps\campus-wall-miniapp\dist\build\mp-weixin
```

Open that output directory with WeChat DevTools.

## 4. Optional H5 Preview

H5 preview starts from port `3001`, so it does not conflict with the backend on `3000`:

```powershell
corepack pnpm run dev:h5
```

Open:

```text
http://localhost:3001
```

In H5 preview, leave the API URL field empty unless you need to test another backend. Empty means requests use `/api/...` on the H5 dev server, and Vite proxies them to the backend on `127.0.0.1:3000`. This avoids browser CORS and cookie header issues.

If `3001` is already occupied, Vite will automatically use the next available port, for example:

```text
http://localhost:3002
```

## 5. API URL In WeChat DevTools

For local debugging, `localhost` may refer to the simulator environment. If requests fail, use the LAN address printed by Next.js, for example:

```text
http://10.0.0.135:3000
```

You can edit the API URL from the mini program login/profile page. The value is stored locally in mini program storage under:

```text
campus_wall_api_base
```

## 6. WeChat Request Domain

For a real device preview or release, WeChat requires a legal HTTPS request domain.

Local-only options:

- Use WeChat DevTools simulator and disable request domain checks for development.
- Use a tunnel such as an HTTPS reverse proxy to expose `localhost:3000`.

Production option:

- Deploy the web/API server to an HTTPS domain.
- Add that domain in the WeChat Mini Program admin console.
- Set the mini program API URL to that HTTPS domain.

## 7. Shared Portable Runtime

The mini program does not connect to PostgreSQL or Redis directly. It only calls the web/API server.

PostgreSQL and Redis are required by the backend, and can be reused through the shared portable runtime documented in:

```text
docs\portable-runtime-reuse-guide.md
```
