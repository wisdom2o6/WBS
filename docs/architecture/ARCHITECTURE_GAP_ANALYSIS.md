# Workspace 1.0 Architecture Gap Analysis

**Baseline:** PRD v1.0.9, inspected 2026-11-08.  
**Status:** Pending Review. This is an evidence-based gap inventory, not an
implementation plan.

## Evidence index

The current-state claims in this document are repository observations from:

- `backend/pom.xml` and `backend/src/main/resources/application.properties`
  for actual backend dependencies and PostgreSQL/`ddl-auto` configuration.
- `backend/src/main/java/com/wisdom/wbs/config/WebSocketConfig.java` for `/ws`,
  `/app` and `/topic`; `RoomController.java`, `WhiteboardStateController.java`,
  `DrawController.java`, `EditController.java`, `PresenceController.java` and
  `CursorController.java` for current REST/STOMP behavior.
- `backend/src/main/java/com/wisdom/wbs/entity/WhiteboardRoom.java`,
  `WhiteboardState.java`, the repository and service packages for current
  persistence and room behavior.
- `backend/src/test/java/com/wisdom/wbs` for the existence of backend tests; their
  presence does not claim that PRD acceptance criteria have passed.
- `frontend/package.json`, `frontend/src/App.tsx`,
  `frontend/src/components/RoomLobby.tsx`,
  `WhiteboardCanvas.tsx`, `ParticipantsPanel.tsx` and `LiveCursorsLayer.tsx` for
  the current frontend structure and declared dependencies.

## 1. Current-to-target summary

| Domain | Current repository evidence | Workspace 1.0 target | Gap |
|---|---|---|---|
| IAM | No Spring Security, user, session or token module in `backend/pom.xml` or `backend/src/main`. | JWT access token, HttpOnly rotated refresh token, session family revocation, password policy and four RBAC roles. | Missing module, schema, security filters, revocation and tests. |
| Workspace/Project | No workspace, project, invitation or archive entities/controllers. | Owner SSOT, membership inheritance, invitations, project/room ownership and 30-day archive/restore. | Entire domain missing. |
| Room | `WhiteboardRoom` stores ID and timestamps; create/get endpoints exist. | Room type, project/workspace ownership, public/private membership and resource-specific initialization. | Extend entity/API and enforce authorization; existing room creation has no authenticated owner. |
| Canvas engine | `DrawController` validates/broadcasts draw/shape/text; React `WhiteboardCanvas` renders Konva. | Six P0 object types, canonical object model, frame/sticky/image support, conflict metadata and operation commands. | Reuse rendering and verified interactions; replace controller-owned state with domain service and durable command path. |
| Canvas persistence | `WhiteboardState` stores text JSON; state save overwrites row; `ddl-auto=update`. | JSONB versioned snapshot, operation log, idempotency ledger, durable outbox, snapshot worker and continuity checks. | Core durability model missing; in-memory `AtomicLong` and maps cannot survive restart or coordinate nodes. |
| Undo/redo | `DrawController` keeps `RoomHistory` and participant deques in memory. | Persistent bounded history, durable provenance, LIFO redo, conflict guards, tombstones and compaction-safe lineage. | Replace process-local history; behavior must be revalidated against PRD AC-5.2. |
| Realtime/presence | Spring Simple Broker, `/ws`, `/app`, `/topic`; presence/cursors use service memory. | Authenticated SEND/SUBSCRIBE interception, durable event after commit, presence, secure chat, recovery events and future relay path. | No auth, durable delivery, receipts, broker confirmation or multi-node state. |
| Chat | No chat controller/entity/UI. | PostgreSQL history, WSS/STOMP, room authorization, typing and online list. | Entire domain missing. |
| Documents/Yjs | No Yjs dependency, document entity or editor. | Node Yjs runtime, binary update/revision persistence, snapshot/state-vector compaction and projection. | Entire domain/runtime missing; requires OTD-01 proof. |
| Media | No media dependency, storage config or asset table. | S3-compatible quarantine, presigned policy, validation, SVG sanitization, scanning, READY gating and reference counting. | Entire domain and object-store boundary missing. |
| Notifications/workers | No worker or scheduler module found. | P0 roles: Canvas Outbox, Canvas Snapshot, Yjs Compaction, Media Scanning, Orphan Cleanup and Archive Lifecycle. Notification Bell/notification-center is P1 or deferred. | Missing required worker roles and retry/observability contracts; notification UX/backend is deliberately outside P0. |
| Database | PostgreSQL configured; JPA schema auto-update; two tables/entities. | Flyway-managed relational schema with JSONB and durable constraints/indexes. | Migration discipline and nearly all target tables missing. |
| Frontend | React/Vite lobby, room URL, Konva canvas, participants, cursors and export. | Authenticated workspace/project/room shell, chat, Yjs editor, media flows, recovery and state management. | Major UI surfaces missing; hard-coded localhost API and no auth state. |
| Testing | Backend unit/controller/listener/service tests are present; frontend scripts have build/lint. | Acceptance tests for durability, concurrency, auth, recovery, media and browser flows. | Current tests do not demonstrate PRD invariants or end-to-end behavior. |
| Deployment | Maven/Vite development tooling and localhost properties. | Single-node Spring + worker roles + Node sidecar + PostgreSQL + MinIO, with measured future scale path. | Deployment configuration, secrets, health, metrics and recovery runbooks missing. |

## 2. Reusable components

1. **Canvas rendering:** `frontend/src/components/WhiteboardCanvas.tsx` and its
   Konva integration are the primary reuse boundary. Preserve rendering behavior
   while adapting its input/output to canonical versioned objects.
2. **Room/lobby UX:** `RoomLobby.tsx`, `App.tsx`, and room URL handling provide a
   usable starting shell, but must move to authenticated API configuration.
3. **Realtime vocabulary:** `WebSocketConfig.java`, controller message mappings and
   `@stomp/stompjs` establish a migration-compatible STOMP vocabulary. They should
   be wrapped by authorization and application-command services, not discarded.
4. **Room lookup and basic persistence:** `WhiteboardRoom`, `WhiteboardState`,
   repositories and `WhiteboardRoomService` provide migration evidence and legacy
   compatibility needs. They are not sufficient as the target data model.
5. **Validation and test seams:** existing controller/service tests identify current
   request shapes and observable behavior to preserve while adding P0 contracts.

## 3. Components requiring extension

- Convert room identity into authenticated workspace/project/room ownership and
  membership; preserve the current room-code usability where compatible with PRD.
- Replace `DrawController` JVM maps with a transaction service that locks the room
  row, assigns `room_version`, writes operation/idempotency/undo and
  `CANVAS_OUTBOX` rows and broadcasts only after commit. Canvas Persistence owns
  transactional outbox creation; Background Processing owns polling, advisory
  locks, Head-of-Line ordering, retry, scheduling and dispatch. Realtime owns
  STOMP handling and broker adapters, not outbox dispatch.
- Add transactional chat message persistence plus a dedicated `CHAT_OUTBOX` or
  generalized `DOMAIN_OUTBOX`; Chat owns row creation and Background Processing
  owns dispatch. Chat must not consume Canvas `room_version`.
- Replace `WhiteboardState` text replacement with a versioned JSONB snapshot and
  canonical object/conflict metadata. Keep a compatibility reader during migration
  only if Stage 0.3.2 approves a legacy transition.
- Add STOMP channel interception and per-destination authorization. Presence may be
  ephemeral, but membership checks and revocation must be authoritative.
- Add client version deduplication and snapshot-aware recovery; do not rely on a
  retained operation-ID set alone.
- Add Flyway and explicit constraints/indexes; stop relying on `ddl-auto=update`
  for Workspace 1.0.

## 4. Missing modules and dependencies

### P0 missing

IAM; workspace/project/invitations; room membership and archive; canvas operation
log/outbox/idempotency/snapshot/undo; secure chat; Yjs document runtime and adapter;
media asset lifecycle; Canvas/Yjs/media/archive background workers; Flyway schema;
object storage; security and observability configuration. Notification Bell and
notification-center functionality are P1 or deferred, not P0 missing work.

### Non-code dependencies

PostgreSQL with suitable connection-pool sizing; MinIO or S3; a malware scanning
service; SMTP/email provider for invitations; a production STOMP broker only when
multi-node deployment is justified; secrets management;
metrics/logging/tracing and backup/restore procedures.

## 5. Technical risks and mitigations

| Risk | Why it matters | Mitigation/evidence required |
|---|---|---|
| JVM-local versions/history | Restart or second node can duplicate/reorder operations. | Database row lock, operation ledger, outbox and restart tests. |
| Commit/broadcast inversion | Clients can observe events that persistence later rolls back. | Outbox-only publication and crash-boundary tests. |
| HOL retry regression | Later versions can bypass a failed older event and break client continuity. | Oldest-incomplete selection and per-room dispatcher tests. |
| Snapshot compaction deletes needed history | Gaps make recovery/rebase unsafe. | Repeatable-read gap resync, continuity validation and watermark tests. |
| Undo metadata loses lineage after compaction | Collaborative edits can be overwritten or incorrectly restored. | Durable object versions, provenance, tombstones and conflict tests. |
| Unauthorized realtime access | REST authorization alone does not protect STOMP destinations or Yjs. | Independent connection, SEND and SUBSCRIBE authorization tests plus revocation disconnect. |
| Ambiguous advisory lock identity | Passing string room IDs directly is invalid; inconsistent mappings can serialize the wrong resources. | Domain-separated deterministic BIGINT mapping shared by Canvas Dispatcher/Snapshot Worker; separate Document namespace; collision monitoring and tests. |
| Yjs binary/protocol drift | Documents may fail to sync or compact consistently. | Version-pinned conformance fixtures and sidecar persistence tests. |
| Yjs dual writers | Spring and sidecar could allocate revisions or write updates independently. | Sidecar sole writer for binary update/revision/snapshot/state-vector/projection rows; least-privilege DB role and shared schema contract. |
| Sidecar membership access ambiguity | Sidecar may use stale or over-privileged authorization data. | Stage 0.3.2–0.3.3 choose authenticated authorization API or minimum restricted read-only membership access; no write privileges over IAM, membership, Canvas or Chat. |
| Conflicting document revision writers | Spring metadata transactions could accidentally update the Yjs revision sequence. | Physical design uses column-level grants or a separately owned revision/sequence record and verifies one authoritative writer. |
| Connection-ticket leakage or replay | A fallback ticket could grant room access or expose credentials through logs. | Short-lived, single-use atomic ticket bound to user/room; Origin validation; redact application/proxy logs; never place long-lived tokens in query strings. |
| Chat/canvas ordering conflation | Reusing Canvas `room_version` for chat would couple unrelated streams. | Dedicated CHAT_OUTBOX or generalized DOMAIN_OUTBOX with aggregate identity and chat sequence; reconnect replay by message identity/sequence. |
| Untrusted media becomes readable | Malicious files can reach users or storage consumers. | Quarantine prefixes, magic-byte/SVG/AV checks, READY-only reads and cleanup. |
| Single-node broker assumptions | Simple Broker cannot provide clustered delivery. | Keep 1.0 single-node; define measured relay cutover and broker receipt tests. |
| Schema auto-update | Runtime schema changes are not reviewable or safely repeatable. | Flyway design, migration validation and backup/restore rehearsal. |

## 6. Unresolved decisions

These are not silently resolved by this document:

- Exact Spring Security/JWT library and token storage model.
- Exact STOMP relay broker and the trigger for moving off Simple Broker.
- Node.js runtime/version and Yjs package versions.
- Browser-to-Yjs credential mode (same-site HttpOnly cookie versus single-use HTTPS
  connection ticket), exact browser ticket transport in Stage 0.3.3, revocation
  control path and measured `<1 second` SLA.
- Sidecar membership acquisition through authenticated authorization API versus
  minimum restricted read-only database access.
- MinIO versus managed S3, bucket policy, encryption and retention settings.
- Malware scanner integration and maximum quarantine duration.
- Whether worker roles are separate processes or Spring profiles in one artifact.
- JSON projection rules from Yjs and whether document search is P0 or later.
- Dedicated CHAT_OUTBOX versus generalized DOMAIN_OUTBOX and its physical sequence/index design.
- Legacy `room-1` compatibility and migration of existing `whiteboard_states`.

## 7. Proposed Stage 0.3.2 scope — Physical Database Design

Stage 0.3.2 should produce a reviewed physical schema and migration contract, without
implementing application behavior:

1. Normalize the PRD ERD into PostgreSQL tables for users, sessions, workspaces,
   members, invitations, projects, rooms and room members.
2. Define Canvas tables for room version, unified JSONB snapshots, operation log,
   idempotency ledger, outbox, undo history, object conflict metadata and tombstones.
3. Define document tables for document revision, binary updates, snapshots, state
   vectors and projection metadata.
4. Define media asset, upload intent, scan result, reference and lifecycle states.
5. Specify primary/foreign/composite uniqueness, check constraints, indexes, retention
   and archive rules.
6. Specify transaction isolation and locking statements for room versions, outbox
   dispatch, snapshot compaction, Yjs compaction and repeatable-read gap recovery;
   choose the exact domain-separated BIGINT advisory-key encoding and collision policy.
7. Define the physical chat outbox choice, aggregate identity, independent chat
   sequence, reconnect replay, retry and reconciliation semantics.
8. Define Yjs column grants or separate revision/sequence ownership so Spring and
   the sidecar cannot become conflicting revision writers.
9. Define Flyway migration ordering, seed/legacy transition policy and rollback/
   backup considerations.
10. Map each physical table/constraint to PRD v1.0.9 acceptance criteria and identify
   any requirement that cannot be represented safely in PostgreSQL.

No source code or database migration is created by Stage 0.3.1.
