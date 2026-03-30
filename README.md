# CloudDoc

Monorepo for the V1 cloud document application.

## Structure

- `apps/web`: Next.js frontend
- `apps/api`: FastAPI backend
- `cloud-doc-prd.md`: product requirement document
- `cloud-doc-feature-ui-design.md`: feature and UI design
- `cloud-doc-content-model.md`: document content model

## Product Scope

- V1 ships only `doc`
- No real-time collaboration in V1
- Continuous-document presentation with a structured JSON content model
- Python backend with PostgreSQL
- Frontend based on Next.js and TipTap-compatible editor architecture

## Development Setup

### Frontend

```bash
cd apps/web
cp .env.local.example .env.local
npm install
npm run dev
```

### Backend

```bash
cd apps/api
uv sync
cp .env.example .env
uv run uvicorn app.main:app --reload
```

### Database

Example PostgreSQL connection:

```text
postgresql://user:password@localhost:5432/clouddoc
```

Set it in `apps/api/.env` as `DATABASE_URL`.

## Current Backend Endpoints

- `GET /health`
- `GET /api/documents`
- `POST /api/documents`
- `GET /api/documents/{doc_id}`
- `PUT /api/documents/{doc_id}/content`

## Demo Document

When the API starts successfully, it auto-creates a demo workspace and document:

```text
11111111-1111-1111-1111-111111111111
```

Open it in the frontend at:

```text
/docs/11111111-1111-1111-1111-111111111111
```
