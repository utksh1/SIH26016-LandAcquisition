# Frontend-Backend API Integration

## Overview
The frontend now supports connecting to the real backend API at `http://localhost:8080`. When the backend is unavailable, it automatically falls back to mock data.

## Configuration

### Environment Variables
Create a `.env` file in `apps/web/` with:

```bash
# Backend API URL (default: uses mock data if not set)
VITE_API_URL=http://localhost:8080

# Development authentication token (required for authenticated endpoints)
VITE_API_TOKEN=your-dev-token-here
```

### Getting an Authentication Token
The backend uses Bearer token authentication. To get a token:
1. Contact your backend administrator
2. Or generate one using the backend's DevAuth system with `SIH_DEV_AUTH_SECRET`

## Connected APIs

### Dashboard
- **Endpoint**: `GET /dashboard`
- **Purpose**: Fetch project counts by stage
- **Fallback**: Mock KPI data

### Projects
- **List**: `GET /projects`
- **Get**: `GET /projects/{id}`
- **Create**: `POST /projects`
- **Transition**: `POST /projects/{id}/transition`

### Parcels
- **Create**: `POST /projects/{id}/parcels`
- **Get**: `GET /parcels/{id}`

## Features

### Automatic Fallback
- If `VITE_API_URL` is not set → uses mock data
- If API request fails → falls back to mock data
- Error messages displayed in UI

### Loading States
- Dashboard shows "Loading dashboard..." while fetching
- Error messages displayed in red banner

### Authentication
- All API requests include `Authorization: Bearer {token}` header
- Token configured via `VITE_API_TOKEN` environment variable

## Development Workflow

### Using Mock Data (Default)
```bash
npm run dev
# No .env file needed, uses mock data automatically
```

### Using Real Backend
```bash
# 1. Start backend (in project root)
cd services/api
cargo run

# 2. Configure frontend
cd apps/web
echo "VITE_API_URL=http://localhost:8080" > .env
echo "VITE_API_TOKEN=your-token" >> .env

# 3. Start frontend
npm run dev
```

### Building for Production
```bash
npm run build
# Output: dist/ directory with static files
```

## API Client Usage

The `apiClient` in `src/api/client.ts` provides typed methods:

```typescript
import { apiClient } from './api/client'

// List all projects
const projects = await apiClient.listProjects()

// Get specific project
const project = await apiClient.getProject(projectId)

// Create project
const newProject = await apiClient.createProject({
  name: 'NH-48 Widening',
  authority: 'national_highways',
  state_code: 'RJ',
  district_code: 'BHR'
})

// Transition project stage
const updated = await apiClient.transitionProject(projectId, {
  to: 'compensation_award',
  actor: {
    id: 'actor-id',
    role: 'district_collector',
    jurisdiction: { district: { code: 'BHR' } }
  }
})
```

## Error Handling

All API errors are caught and:
1. Logged to console
2. Displayed in UI error banner
3. Trigger fallback to mock data

## Files Modified

- `apps/web/src/api/client.ts` - Added authentication headers
- `apps/web/src/App.tsx` - Integrated API calls with loading/error states
- `apps/web/src/styles.css` - Added loading/error message styles
- `apps/web/.env.example` - Environment variable documentation
- `apps/web/.env` - Local development configuration

## Next Steps (Phase 4)

- GIS map integration with real parcel data
- DILRMP integration for land records
- PFMS integration for payment tracking
- Document extraction service integration
