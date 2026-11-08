# Architecture Decision Records — Workspace 1.0

**Baseline:** PRD v1.0.9.  
**Review status:** All four decisions are **Proposed**. None is Accepted or Deferred by
the product owner. Verification date for cited technical claims: 2026-11-08.

## OTD-01 — Yjs Runtime

**Status:** Proposed — recommend A for Workspace 1.0.

### Problem and context

The document editor requires Yjs binary updates, durable revisions, snapshots,
watermark compaction and authorization before ACK/broadcast. The repository has no
Yjs runtime or persistence adapter. PRD v1.0.9 explicitly requires durability before
ACK and independent JWT/RBAC enforcement.

### Candidates

- **A — Node.js Yjs collaboration sidecar.** Use the Yjs ecosystem and a project-owned
  PostgreSQL adapter implementing `DOCUMENT`, `DOCUMENT_UPDATE` and
  `DOCUMENT_SNAPSHOT` revision rules.
- **B — Yrs Rust through JNI/Java FFI.** Embed or call the Rust port from the JVM,
  adapting Java requests to Yrs and maintaining FFI lifecycle/ABI boundaries.

| Criterion | A: Node.js sidecar | B: Yrs JNI/FFI |
|---|---|---|
| Ecosystem compatibility | Strong: native Yjs protocol and browser packages; less protocol translation. | Requires compatibility testing across Yjs/Yrs versions and bindings. |
| Binary interoperability | Native Yjs update/state-vector representation. | Potentially compatible, but must be proven with conformance vectors. |
| PostgreSQL persistence | Explicit adapter required; straightforward Node PostgreSQL client. | Explicit adapter required plus JNI/thread/native error handling. |
| AuthN/AuthZ | Sidecar can validate JWT and room membership directly. | Same requirement, but integration is inside/near JVM security boundaries. |
| Operations/debugging | Separate runtime and process; familiar JS tooling; extra deployment health check. | One JVM deployment appearance, but native crashes and FFI diagnostics are harder. |
| Performance | Adequate for Workspace 1.0; benchmark document sizes and update rates. | Potentially lower boundary overhead and strong native performance. |
| Team/maintenance | Better fit for Yjs ecosystem; isolates protocol upgrades. | Higher specialist skill and upgrade/testing burden. |
| Scale | Can scale independently later; requires shared durable state and routing. | JVM scaling path is simpler operationally if FFI is stable. |

### Recommendation and consequences

Choose **A** for Workspace 1.0. It minimizes protocol risk and uses the native Yjs
runtime while keeping PostgreSQL durability explicit. The trade-off is one additional
process and a second security boundary. Do not use stock `y-websocket` persistence
unchanged: the adapter must enforce PostgreSQL revision locking, contiguous
compaction and commit-before-ACK.

**Browser authentication and revocation:** Browser WebSockets do not portably allow
arbitrary handshake headers, so a same-site deployment should prefer a Secure,
HttpOnly, SameSite=Lax/Strict session cookie. If cookie routing is not viable, an
authenticated HTTPS call obtains a short-lived, single-use, room-scoped connection
ticket consumed by the sidecar during the handshake. The exact browser transport
for this fallback ticket remains a Stage 0.3.3 decision. The ticket requires short
expiration, single-use atomic consumption, user/room binding, Origin validation,
and redaction from application and proxy access logs. Long-lived access and refresh
tokens are never placed in query strings. The sidecar validates Origin, credential
signature and expiry, atomically consumes tickets, and checks current membership.
IAM sends room/user-scoped revocation events through a durable PostgreSQL-backed
control path; the sidecar indexes sessions by user and closes affected connections.
The measured notification-to-close latency must remain below the PRD `<1 second`
target. Signature verification alone does not detect active session revocation.

**Ownership and least privilege:** Spring owns document title/archive metadata and
IAM/Room integration. The Node sidecar is the sole writer for Yjs binary updates,
document revision allocation, binary snapshots, state vectors and the JSON
projection. It locks and updates the document revision in one transaction with
each update. Spring does not write those rows. The sidecar database role is
restricted to document tables and required transaction/lock operations and cannot
write IAM, membership, Canvas or chat tables. Stage 0.3.2–0.3.3 must decide whether
the sidecar obtains current Room/Workspace membership through an authenticated
internal authorization API or restricted read-only access to the minimum required
membership data. Authorization policy remains owned by Spring and is enforced again
by the sidecar at connection/update time. Physical Database Design must prevent
conflicting revision writers through column-level grants or, if justified, a
separately owned revision/sequence record.

**Risks and mitigations:** binary drift is mitigated by Yjs/Yrs conformance fixtures;
sidecar outage by reconnect plus snapshot/update recovery; unauthorized access by
independent JWT/RBAC checks and revocation-driven disconnect; operational burden by
one-node packaging and health/readiness checks.

**Stage 0.3.2–0.3.6 verification:** schema and revision design; protocol fixture
compatibility; authorization/revocation tests; crash-before/after-commit tests;
compaction continuity tests; document-size and latency benchmark.

**Sources:** [Yjs y-websocket](https://docs.yjs.dev/ecosystem/connection-provider/y-websocket),
[Yjs updates](https://docs.yjs.dev/api/document-updates).

## OTD-02 — Canvas Outbox Dispatcher

**Status:** Proposed — recommend A for Workspace 1.0, consistent with PRD v1.0.9.

### Problem and context

The dispatcher must preserve per-room ordering, at-least-once delivery and strict
head-of-line retry behavior: an older pending/failed event must block later events
for that room, while other rooms continue in parallel. Database commit must precede
broadcast. PRD v1.0.9 already selects transaction-held advisory locking.

| Criterion | A: transaction-held advisory lock | B: durable lease + fencing token | C: CDC |
|---|---|---|---|
| Per-room ordering | Directly enforces one dispatcher transaction per room. | Possible, but lease races/fencing must be exact. | Commit order is observable, but per-room HOL policy remains application logic. |
| Crash recovery | PostgreSQL releases lock on rollback/connection loss. | Lease expiry and fencing recovery are explicit. | CDC offsets/slots and replay recovery are additional state. |
| DB connection occupancy | Holds a connection while broker send occurs; PRD budgets this. | Shorter DB holds; lease renewals add traffic. | Low application transaction occupancy after commit. |
| Network call in transaction | Yes; bounded by PRD timeout/failure bound. | No, preferred for long broker calls. | No, but CDC-to-broker handoff is another durable system. |
| Retry/HOL | Natural: oldest incomplete row is selected regardless of retry time. | Requires lease state and exact oldest-row selection. | Requires an ordered consumer and explicit poison/HOL policy. |
| Multi-worker concurrency | Locks rooms independently; simple PostgreSQL coordination. | Scales workers with fencing complexity. | Best decoupling, highest infrastructure complexity. |
| Workspace 1.0 fit | Highest; no new distributed system. | Viable later if measured connection pressure warrants it. | Not justified before multi-node scale evidence. |

### Recommendation and consequences

Choose **A**. In one transaction, acquire a transaction-level lock using a
deterministic valid BIGINT key, then select the oldest incomplete event, stop if
retry is not due or status is failed, send with a bounded timeout, mark the broker
handoff/confirmation state, and commit. Never use `SKIP LOCKED` in a way that lets a
later room version bypass the head. Cross-room work remains parallel.

**Lock-key convention:** `room_id` is a string and is not passed directly to the
PostgreSQL advisory-lock function. Normalize the canonical identity as UTF-8,
prepend a domain separator, and deterministically map it to a valid BIGINT key.
The Room namespace uses `cwv:room:` plus the canonical room ID, and the same
mapping is mandatory for Canvas Dispatcher and Snapshot Worker. Document compaction
uses the separate `cwv:document:` namespace and its own mapping. All workers use
the same convention for the same resource. A hash collision can cause unnecessary
serialization between different resources; it must never be treated as proof that
they are the same logical resource. Stage 0.3.2 selects the exact hash/encoding and
collision policy. Transaction-level lock lifetime and PRD Head-of-Line guarantees
remain unchanged.

The consequence is a deliberately occupied PostgreSQL connection during the bounded
broker call. The PRD's `<30 ms` normal dispatcher budget, 100 ms failure bound,
2-second transaction timeout and pool sizing must be validated rather than assumed.
If measurements fail, B is the migration path; CDC remains Deferred, not a shortcut
around ordering.

**Stage verification:** contention and crash tests; ordering/HOL/retry tests;
broker confirmation semantics; pool occupancy and latency benchmark; failed-row
replay and tombstone reconciliation.

**Source:** [PostgreSQL advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS).

## OTD-03 — Media Upload Architecture

**Status:** Proposed — recommend A for Workspace 1.0.

### Problem and context

P0 requires images up to 10 MB, documents up to 25 MB, content-length policy,
magic-byte validation, SVG sanitization, quarantine, trusted promotion and
reference counting. Current repository has no media module or object storage.

| Criterion | A: presigned POST + quarantine | B: Spring Boot upload controller |
|---|---|---|
| Server bandwidth | Object bytes bypass Spring; only metadata/validation crosses it. | Every byte traverses Spring and its connection/thread limits. |
| Size enforcement | Signed policy plus server-side `HeadObject` verification. | Straightforward request limit, but still consumes app bandwidth. |
| Magic bytes/SVG/virus scan | Worker validates quarantined object before promotion. | Can validate synchronously, but long scans block requests unless delegated. |
| MinIO/S3 | Native S3-compatible flow; private quarantine/trusted keys. | Also compatible, but app becomes data proxy. |
| Security boundary | Untrusted key is inaccessible to normal reads; promotion is explicit. | Easier single boundary, larger blast radius if endpoint is flawed. |
| Failure/orphan recovery | Upload intent timeout and lifecycle cleanup handle abandoned objects. | Failed requests still need cleanup and partial-upload handling. |

### Recommendation and consequences

Choose **A**: Spring authorizes an upload intent and signs a short-lived POST to a
quarantine prefix; the browser uploads directly; a worker verifies object size and
magic bytes, sanitizes SVG, scans content, records immutable metadata and promotes
to a trusted key only on `READY`. Application download/render paths deny all other
states. Reference counts and a delayed orphan cleanup job handle failures.

This adds an object-store and worker dependency but avoids turning Spring into a
large-file proxy. A controller upload remains a fallback for environments where
presigned policy support is unavailable, not the default.

**Stage verification:** policy bypass and oversize tests; MIME/magic-byte mismatch;
SVG active-content sanitization; scanner timeout/failure; promotion atomicity;
authorization before/after `READY`; orphan and reference-count cleanup.

**Sources:** [AWS S3 POST policy](https://docs.aws.amazon.com/AmazonS3/latest/developerguide/sigv4-HTTPPOSTConstructPolicy.html),
[MinIO Java PostPolicy](https://minio-java.min.io/io/minio/PostPolicy.html),
[MinIO Java Client](https://minio-java.min.io/io/minio/MinioClient.html).
Compatibility must be verified against the actual MinIO/AiStor server and selected
SDK versions; an SDK API reference alone is not proof of server compatibility.

## OTD-04 — Message Broker

**Status:** Proposed — recommend A for Workspace 1.0.

### Problem and context

The current application uses Spring's in-process Simple Broker. P0 requires secure
STOMP chat and canvas delivery; PRD requires a future scale path without weakening
outbox semantics.

| Criterion | A: Simple Broker now, STOMP Broker Relay later | B: custom Redis Pub/Sub bridge |
|---|---|---|
| STOMP support | Native Spring STOMP now; native broker relay later. | Application must translate STOMP to Redis and back. |
| Receipts/ACK | Simple Broker is limited; external relay provides broker features. | Semantics are custom and must be rebuilt. |
| Multi-node | Not suitable for clustering until relay is introduced. | Possible fan-out, but every node needs bridge correctness. |
| Per-room ordering | Outbox/application controls ordering; broker is delivery transport. | Redis channel ordering is not a substitute for durable per-room outbox ordering. |
| Failure recovery | Relay/broker operational failure is explicit; outbox retries. | Pub/Sub is ephemeral; disconnects lose messages unless another durable system exists. |
| Complexity | Lowest now, documented migration path. | Highest custom protocol and failure semantics. |

### Recommendation and consequences

Choose **A**. Keep Simple Broker for the single-node deployment, but treat it as
transport only and preserve all durability/order guarantees in PostgreSQL outbox.
When multi-node requirements are measured, replace the broker configuration with
Spring's STOMP Broker Relay to RabbitMQ/ActiveMQ or another STOMP-native broker.
Do **not** call Redis Pub/Sub a native STOMP Broker Relay; option B is Deferred.

**Stage verification:** authenticated SEND/SUBSCRIBE rejection; broker handoff and
receipt semantics; reconnect/replay; multi-node ordering; outbox duplicate delivery
and client version deduplication.

### Chat publication boundary

The physical design remains open for Stage 0.3.2, but the logical boundary is
explicit: use either a dedicated `CHAT_OUTBOX` or a generalized `DOMAIN_OUTBOX`
with aggregate type/ID and an independent per-chat-room sequence. Do not place chat
rows in `CANVAS_OUTBOX` or assign Canvas `room_version` to chat. Chat messages are
durably persisted before publication. Publication is at-least-once and may be
delayed or duplicated; clients deduplicate using message identity and replay missing
messages from PostgreSQL after reconnect using the chat sequence. If persistence
commits but publication fails, the chat outbox remains pending and is retried. If
publication succeeds but acknowledgement is lost, retry is safe because the client
deduplicates. Chat ordering is independent of Canvas ordering.

**Source:** [Spring external broker documentation](https://docs.spring.io/spring-framework/reference/web/websocket/stomp/handle-broker-relay.html).

## Decision summary

| ID | Recommendation | Status |
|---|---|---|
| OTD-01 | Node.js Yjs sidecar with PostgreSQL adapter | Proposed |
| OTD-02 | Transaction-held PostgreSQL advisory lock | Proposed |
| OTD-03 | Presigned POST + quarantine + validation + trusted promotion | Proposed |
| OTD-04 | Simple Broker for one node; future STOMP Broker Relay | Proposed |
