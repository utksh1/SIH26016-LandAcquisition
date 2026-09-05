# LandFlow web dashboard

Vite + React + TypeScript frontend for the SIH26016 land acquisition and rehabilitation workflow.

## Run locally

From this directory:

```bash
npm ci
npm run dev
```

The development server listens on `http://127.0.0.1:5173` and fails rather than silently selecting another port. Preview builds use `http://127.0.0.1:4173`.

## API configuration

The API client in `src/api/client.ts` selects its data source at build time:

- **Mock mode (default):** when `VITE_API_URL` is unset or blank, requests use the typed in-memory fixtures in `src/api/mockData.ts`. This is safe for local demos and does not require a backend.
- **API mode:** set `VITE_API_URL` to the backend origin or base path. The client appends each endpoint path, so do not include a trailing slash. For example:

  ```bash
  VITE_API_URL=http://127.0.0.1:8080/api npm run dev
  ```

  For a persistent local setting, put the variable in an ignored `.env.local` file. Do not commit credentials or other secrets; Vite exposes `VITE_*` values to browser code.

When `VITE_API_URL` is set, network errors and non-successful API responses are surfaced to the frontend; they do not silently fall back to mock data. Clear the variable to return to mock mode.

## Build

```bash
npm ci
npm run build
```

The build runs TypeScript project checks followed by Vite production bundling. Use `npm run preview` to inspect the generated `dist` output locally.
