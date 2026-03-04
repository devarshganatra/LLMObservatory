# LLM Observability Backend

Production-grade backend for LLM monitoring, drift detection, and insights generation. Built with a focus on high availability, distributed safety, and asynchronous processing.

## Architecture

The system is split into two primary roles:
1. **API Server**: Handles HTTP requests, authentication, and job enqueuing.
2. **Worker Process**: Dedicated BullMQ worker for heavy pipeline execution (inference, embeddings, drift analysis).

## Core Features

- **Distributed Rate Limiting**: Token Bucket algorithm implemented in Redis via Lua scripts for atomic, thread-safe limiting.
- **Intelligent Caching**: Redis-based caching with targeted invalidation strategies for run data and lists.
- **Session Management**: JWT revocation using JTI blacklisting in Redis with automatic TTL expiry.
- **Asynchronous Processing**: long-running LLM evaluation pipelines are offloaded to BullMQ with support for retries and concurrency control.
- **Production Persistence**: Fully DB-native architecture using PostgreSQL with granular status tracking.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL (pgvector for embeddings)
- **Cache/Queue**: Redis (BullMQ)
- **Logging**: Pino (Structured JSON)
- **Validation**: Zod

## Infrastructure Config

Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string.
- `REDIS_URL`: Redis connection string (supports Upstash TCP).
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`: Secrets for authentication.
- `PORT`: API server port (default 3001).

## Operational Scripts

Start the API server:
```bash
npm run start:api
```

Start the background worker:
```bash
npm run start:worker
```

Run database migrations:
```bash
node run-migration.js
```

## Pipeline Execution Flow

1. Client triggers a run via `POST /api/runs`.
2. API initializes a `pending` record in PostgreSQL and enqueues a job in BullMQ.
3. API returns `202 Accepted` immediately.
4. Worker picks up the job, transitions status to `processing`.
5. Worker executes full pipeline: inference -> features -> embeddings -> drift -> insights.
6. Worker marks run as `completed` or `failed`.
7. Client polls `GET /api/runs/:id` to monitor progress.
