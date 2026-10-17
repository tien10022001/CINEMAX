<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# CINEMAX ARCHITECTURE RULE: DATABASE AS SINGLE SOURCE OF TRUTH (SSOT)

> **MANDATORY FOR ALL ACTIONS:** Follow the 15 principles defined in [.agents/rules/database_single_source_of_truth.md](file:///c:/Users/Tien/Desktop/Cinemax_v1/CINEMAX/.agents/rules/database_single_source_of_truth.md).

1. **NO PEER CLIENT SYNC:** Do NOT sync state directly between browser tabs/clients using `localStorage`, `BroadcastChannel`, or fake window events as source of truth.
2. **ALL CRUD VIA BACKEND API:** Every create/update/delete operation must go through Backend API (`/api/...`).
3. **TRANSACTION & DB COMMIT FIRST:** Authenticate, check RBAC, validate business logic, and commit to Database BEFORE publishing events.
4. **REALTIME ONLY AFTER DB COMMIT:** Only broadcast realtime events after DB transaction successfully commits.
5. **NO FAKE/OPTIMISTIC DRIFT:** Do not mark UI as success if API/DB failed. Rollback on errors.
6. **PROPER EVENT PAYLOAD:** `{ eventId, entityType, entityId, action, actorId, actorRole, timestamp, version, data }`.
7. **PREVENT CONFLICTS & DUPLICATES:** Use `version` / `updated_at` (Optimistic Concurrency Control) and `Idempotency-Key`.
8. **AUDIT LOG & SOFT DELETE:** Audit sensitive mutations (`audit_logs`) and prefer soft delete (`deleted_at`).
9. **ZERO TRUST RBAC:** Admin (full system), Staff (own shift/counter), User (own data), Guest (minimal / request-based).
10. **NO DB CREDENTIALS ON FRONTEND:** Never expose service role or connect directly from frontend with bypass keys.

