# WBS frontend upgrade

## Preservation audit

The imported application is a React 19 / TypeScript / Vite 8 frontend using
React Router 7, AuthContext, axios, React-Konva, STOMP, SockJS, and jsPDF.
It had `/login`, `/register`, `/dashboard`, and `/room/:roomId` routes.
There was no component library, application shell, feature-level state layer,
or design-token system. Styling was primarily inline.

### Existing files inspected

- Every original file under `src`: `App.tsx`, `main.tsx`, `index.css`,
  `context/AuthContext.tsx`, `utils/api.ts`, and the four original pages:
  `Login.tsx`, `Register.tsx`, `Dashboard.tsx`, `RoomCanvas.tsx`.
- Frontend manifest, lockfile, README, TypeScript configurations, Vite config,
  lint configuration, and HTML entry point; root manifest and lockfile.
- Existing `.figma/make` install, dev, deploy, deploy-preview, watcher, and
  toolchain configuration. These lifecycle files were not changed.
- Spring `AuthController`, `WorkspaceController`, `CanvasRealtimeController`,
  `FileUploadController`, all request/response DTOs, `WorkspaceService`,
  `CanvasPersistenceService`, `WebSocketConfig`, `ContentType`, `UserRole`,
  and application configuration. Backend source was read-only.

### Confirmed integration corrections

The old dashboard posted project and room creation to nonexistent top-level
routes and omitted the workspace slug required by request validation.
The new service uses the actual controller contracts:

| Operation                       | Existing backend contract                       |
| ------------------------------- | ----------------------------------------------- |
| Login/register                  | `POST /api/v1/auth/login`, `/auth/register`     |
| Workspace list/create           | `GET/POST /api/v1/workspaces`                   |
| Workspace edit/delete           | `PUT/DELETE /api/v1/workspaces/:id`             |
| Project create                  | `POST /api/v1/workspaces/:workspaceId/projects` |
| Project edit/delete             | `PUT/DELETE /api/v1/projects/:id`               |
| Room create                     | `POST /api/v1/projects/:projectId/rooms`        |
| Room edit/delete                | `PUT/DELETE /api/v1/rooms/:id`                  |
| Member list/add registered user | `GET/POST /api/v1/workspaces/:id/members`       |
| Canvas history                  | `GET /api/v1/rooms/:roomId/canvas`              |
| File upload                     | `POST /api/v1/upload` with multipart `file`     |

STOMP endpoint `/ws-visual-workspace`, authorization headers, `/app/room.:id.draw`,
`.cursor`, `.chat`, corresponding `/topic` subscriptions, and `/topic/presence`
are preserved. Canvas payloads remain compatible with the backend's arbitrary
JSON object persistence. New object metadata travels inside those payloads.

## File inventory

### Modified

- `src/App.tsx`: routes, protected live shell, separate demo shell, lazy modules.
- `src/main.tsx`, `src/index.css`, `index.html`: styles, metadata, local fonts.
- `src/context/AuthContext.tsx`, `src/utils/api.ts`: existing JWT behavior plus
  session-only login support and safe stored-user parsing.
- `src/pages/Login.tsx`, `Register.tsx`: reusable redesigned authentication UI.
- `src/pages/Dashboard.tsx`: interactive overview and reusable room previews.
- `src/pages/RoomCanvas.tsx`: original editor engine extended in place.

### Created

- `src/components/Icon.tsx`, `ui.tsx`, `ResourceDialog.tsx`.
- `src/context/WorkspaceContext.tsx`.
- `src/layouts/WorkspaceLayout.tsx`.
- `src/types/workspace.ts`.
- `src/services/workspace.ts`, `recentRooms.ts`.
- `src/data/demo.ts`.
- `src/hooks/useTheme.ts`.
- `src/pages/auth/AuthScreen.tsx`.
- `src/pages/Projects.tsx`, `RoomWorkspace.tsx`, `Documents.tsx`, `Media.tsx`,
  `WorkspacePages.tsx`, `Settings.tsx`.
- `src/features/chat/ChatPanel.tsx`.
- `src/styles/room.css`.
- `public/favicon.svg`, local demo photos with attribution, local public Google
  fonts with OFL license files.
- `tests/browser-smoke.mjs`, `tests/layout-audit.mjs`, and this report.

No package dependencies were added. Package manifests, lockfiles, Vite/build
configuration, backend, and `.figma/make` configuration are unchanged.

## Product routes

`/login`, `/register`, `/forgot-password`, `/verify-email` are public.

Live authenticated routes:

`/workspace`, `/projects`, `/projects/:projectId`, `/rooms`,
`/room/:roomId`, `/room/:roomId/chat`, `/room/:roomId/documents`,
`/room/:roomId/files`, `/documents`, `/documents/:documentId`, `/media`,
`/members`, `/tasks`, `/notifications`, `/activity`, `/settings`.

The same workspace routes under `/demo` use explicit sample/local state and
never authenticate a user or connect to the backend. Signed-out `/` opens the
demo; signed-in `/` opens the live workspace. `/dashboard` remains a legacy
alias for `/workspace`. Existing room URLs remain supported.

## Implemented behavior and integration boundaries

| Module                    | Implemented frontend behavior                                                                                                                                                                                                                                                                           | Data/integration status                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Design system             | User-specified neutral/cobalt tokens, local Plex/Space fonts, consistent SVG icons, controls, dialogs with focus trap, dropdowns, native tooltips, toasts, confirmation/context menus, command search, skeleton/empty/error states                                                                      | Frontend                                                                                                              |
| App shell                 | Collapsible sidebar, nested projects/rooms, workspace switching, contextual navigation, profile menu, mobile drawer                                                                                                                                                                                     | Live workspaces or isolated demo                                                                                      |
| Authentication            | Login/register, validation, password visibility, remembered/session-only login, error/loading feedback                                                                                                                                                                                                  | Existing auth endpoints; no fake login                                                                                |
| Recovery/verification     | Email input and truthful status/instructions                                                                                                                                                                                                                                                            | Backend endpoints absent; no email is reported sent and no verification is reported successful                        |
| Workspaces/projects/rooms | Listing, search, filter, sorting, list/grid, create, rename/edit, delete confirmation, project tabs                                                                                                                                                                                                     | Existing REST contracts; sample adapter in demo                                                                       |
| Members                   | Names, emails, avatars, role display, search, add registered user                                                                                                                                                                                                                                       | Live backend supports Owner/Admin/Member; demo additionally explores Editor/Viewer and removal/role changes           |
| Canvas                    | Original pen, eraser, rectangle, circle, arrows, text, sticky notes, images, select/drag, zoom/pan, live cursors, REST restore, STOMP event persistence, PNG/PDF export retained                                                                                                                        | Existing engine/integrations                                                                                          |
| Canvas extensions         | Ellipse, line, manual connector, visual frame/section, transform persistence, properties, opacity/fill/stroke, layer selection/rename/order/hide/lock, multi-select, group/ungroup/move, align-left, duplicate/delete, bounded local undo/redo, grid, image library insertion, per-object offline queue | Uses existing JSON payload channel; demo edits stay local                                                             |
| Room context              | Canvas/chat/documents/files navigation without remounting the active room engine; draft canvas/chat state survives switching tools                                                                                                                                                                      | Existing live connection retained                                                                                     |
| Chat                      | Live send/receive, current-session search, replies quoted in existing message payload, connection state                                                                                                                                                                                                 | Existing STOMP chat                                                                                                   |
| Chat extensions           | Edit/delete, reaction toggle, pin/filter, reply preview, local attachment, mention insertion, own-draft typing indicator                                                                                                                                                                                | Demo only; no invented live mutation/history/presence endpoints                                                       |
| Security                  | Explicit encryption-unavailable information; no E2EE or encrypted-at-rest claims                                                                                                                                                                                                                        | No cryptographic implementation or private-key storage                                                                |
| Documents                 | Title/description, all requested block categories, block type changes, move/duplicate/delete/add, checklists, editable pipe-delimited tables, images, canvas references, Markdown markers/export, local comments/snapshots                                                                              | Session-only drafts; no document API or Yjs synchronization                                                           |
| Media                     | Gallery/list, drag-drop/browse, uploading/success/error states, search/type/project filters, sort, preview/download, local labels/removal confirmation                                                                                                                                                  | Live binary upload uses existing endpoint; indexing, usage, associations, rename/delete metadata remain session-local |
| Tasks                     | Add/check/delete/filter                                                                                                                                                                                                                                                                                 | Session-local; sample tasks in demo                                                                                   |
| Notifications             | Unread/all, read/unread, mark all, resource navigation                                                                                                                                                                                                                                                  | Sample only; no live delivery endpoint                                                                                |
| Activity                  | Human-readable sample activity plus actions performed during current session                                                                                                                                                                                                                            | No server audit stream                                                                                                |
| Search                    | Loaded workspace/project/room/document/file/member results, keyboard navigation, recent searches                                                                                                                                                                                                        | No search over encrypted message content or invented search endpoint                                                  |
| Settings                  | Live workspace edit/delete, account/session information, security limitations, local light/dark/system preference                                                                                                                                                                                       | Profile/password/avatar/session-enumeration/default-permission updates need backend support                           |

Demo records, workspace-scoped membership changes, tasks, assets, notifications,
documents, and activity are separate from live data. Drafts are retained while
navigating inside the shell but are not durable across a full reload.
Recent room/search metadata and appearance preference use browser storage;
document content and cryptographic material do not.

## Verification

Use the repository's existing commands:

```sh
npm --prefix frontend run build
npm --prefix frontend run lint
```

The production command runs TypeScript and Vite. Route-level modules and jsPDF
are lazy-loaded. The previous approximately 1.48 MB monolithic bundle is split;
two framework/editor chunks remain above Vite's advisory 500 KB threshold.
No warning threshold was raised or hidden.

### Repeatable browser smoke test

The test uses Node 22's built-in WebSocket/fetch with Chromium DevTools Protocol;
no test dependency was added. It requires an **isolated** Chromium profile and
an already running app preview. Do not attach it to a personal browser profile.

```sh
chromium --headless --no-sandbox --disable-dev-shm-usage \
  --remote-debugging-port=9222 --remote-allow-origins='*' \
  --user-data-dir=/tmp/wbs-browser about:blank

node frontend/tests/browser-smoke.mjs
node frontend/tests/layout-audit.mjs
```

Optional non-secret test overrides are `WBS_BROWSER_URL` and `WBS_TEST_URL`.
Screenshots and a runtime-error summary are written to `/tmp/wbs-*`.
The test covers routes, create/search flows, actual Konva pointer drawing,
duplicate/undo/redo, room-tab retention, chat send/edit/pin, document blocks,
local media upload/rename/removal, workspace isolation, membership, tasks,
notification read state, theme changes, authentication protection/forms,
truthful recovery/verification, and mobile navigation/editor panels/layout.
The API-service checks use a test-only axios adapter and verify request
contracts without contacting a backend.

The responsive audit checks 11 main routes at widths 1920, 1024, 768, and
390 pixels, including actual overflow detection. The interaction suite runs at
1440 and 390 pixels and verifies real PNG/PDF/Markdown downloads.

### Recorded results for this upgrade

- `npm --prefix frontend run build`: passed TypeScript and production build.
- `npm --prefix frontend run lint`: passed with zero errors and three
  non-blocking mixed component/hook export warnings for Fast Refresh.
- `node frontend/tests/browser-smoke.mjs`: passed all interaction, export, and
  isolated API-request checks; collected browser errors: zero.
- `node frontend/tests/layout-audit.mjs`: all 44 route/viewport checks passed;
  overflow failures and runtime exceptions: zero.
- Two approximately 578 KB / 591 KB raw JavaScript chunks retain Vite's
  advisory size warning (approximately 171 KB / 182 KB gzip). Feature routes
  and the PDF export library are already lazy-loaded.
- Live server/database/authentication/multi-client synchronization were not
  exercised against a running Spring/PostgreSQL service. Request-contract
  fixture checks are not a substitute for that integration verification.

## Remaining production limitations

- The imported API/WebSocket/upload URL remains `http://localhost:8080` as
  requested. A remotely accessible backend, PostgreSQL, and an appropriate
  secure transport/origin strategy are still required for live remote use.
- Live authentication, database persistence, multi-browser collaboration and
  server-side authorization cannot be certified without a running backend.
  No backend or database changes were made.
- STOMP receipt is not a database-save acknowledgement. The imported backend
  catches persistence errors; the UI deliberately does not claim a guaranteed
  durable save. Offline edits are queued per object only for the mounted room.
- Undo/redo affects locally recorded object IDs rather than removing unrelated
  concurrent additions. Concurrent edits to the same object remain last-write
  wins, not CRDT/operational-transform collaboration.
- Frames and sections are visual organizational objects, not clipping,
  nested-layout or auto-layout containers. Connectors have manually positioned
  endpoints. Alignment currently implements left alignment.
- New metadata/tools require the upgraded frontend on collaborating clients.
  Older clients may ignore unfamiliar object types or metadata.
- Persistent documents, chat history/mutations/attachments, invitations,
  project membership, granular roles, notifications, asset indexing, account
  updates, recovery, verification and E2EE require future backend work.
- Document formatting is deliberately a lightweight Markdown/block abstraction,
  not a full rich-text or multiplayer editor. Export drafts before reloading.
- The imported backend's broader security/access-control configuration was not
  changed or audited as a production security assessment.

No publish or deployment was performed.
