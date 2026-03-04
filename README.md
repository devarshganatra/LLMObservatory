# LLM Observatory

Enterprise-grade platform for LLM monitoring, drift detection, and insight generation.

## Project Structure

- **backend/**: Node.js Express server and BullMQ worker implementation.
- **data/**: Local storage for pipeline artifacts (features, drift metrics, insights) used for downstream processing.

## Quick Start (Backend)

The backend is split into an API process and a background worker process.

### Prerequisites

- PostgreSQL (with pgvector)
- Redis (compatible with BullMQ, e.g., Upstash)

### Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables in `.env`:
   ```env
   DATABASE_URL=postgres://...
   REDIS_URL=redis://...
   JWT_ACCESS_SECRET=...
   JWT_REFRESH_SECRET=...
   ```

### Execution

Start the API server:
```bash
npm run start:api
```

Start the background worker:
```bash
npm run start:worker
```

## Key Infrastructure

- **BullMQ**: Orchestrates asynchronous evaluation pipelines.
- **Token Bucket Rate Limiting**: Distributed rate limiting using Redis Lua scripts.
- **pgvector**: Stores and queries high-dimensional embeddings for drift analysis.
- **Pino**: Structured JSON logging for production observability.

For detailed backend implementation details, see [backend/README.md](backend/README.md).
# LLM Observatory

Enterprise-grade platform for LLM monitoring, drift detection, and insight generation.

## Project Structure

- **backend/**: Node.js Express server and BullMQ worker implementation.
- **data/**: Local storage for pipeline artifacts (features, drift metrics, insights) used for downstream processing.

## Quick Start (Backend)

The backend is split into an API process and a background worker process.

### Prerequisites

- PostgreSQL (with pgvector)
- Redis (compatible with BullMQ, e.g., Upstash)

### Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables in `.env`:
   ```env
   DATABASE_URL=postgres://...
   REDIS_URL=redis://...
   JWT_ACCESS_SECRET=...
   JWT_REFRESH_SECRET=...
   ```

### Execution

Start the API server:
```bash
npm run start:api
```

Start the background worker:
```bash
npm run start:worker
```

## Key Infrastructure

- **BullMQ**: Orchestrates asynchronous evaluation pipelines.
- **Token Bucket Rate Limiting**: Distributed rate limiting using Redis Lua scripts.
- **pgvector**: Stores and queries high-dimensional embeddings for drift analysis.
- **Pino**: Structured JSON logging for production observability.

For detailed backend implementation details, see [backend/README.md](backend/README.md).

You can find the in depth flow of the project here:- [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/devarshganatra/LLMObservatory)
