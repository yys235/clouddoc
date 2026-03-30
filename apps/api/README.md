# CloudDoc API

## Run

```bash
uv sync
cp .env.example .env
uv run uvicorn app.main:app --reload
```

## Database

Example development connection:

```text
postgresql://user:password@localhost:5432/clouddoc
```
