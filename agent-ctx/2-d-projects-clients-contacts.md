# Task 2-d — Projects, Clients & Contacts modules

Agent: 2-d (module implementer)
Files modified (only these three):
- `src/components/views/projects.tsx` — `ProjectsView`, `ProjectDetailView({ id })`
- `src/components/views/clients.tsx` — `ClientsView({ query })`
- `src/components/views/contacts.tsx` — `ContactsView({ query })`

## What was built

### ProjectsView
- 4 StatCards: Active (status ≠ COMPLETED), Completed, Total budget (sum → `fmtMoney`), Deadlines this month (calendar-month match).
- Filter bar: status pills (`PROJECT_STATUS_ORDER` + All, each with live counts, contract pill styling), type `Select` (PROJECT_TYPES), client-side search box (name + client name).
- Project cards `sm:grid-cols-2 xl:grid-cols-3`: name, client (or "Internal"), type StatusBadge, status StatusBadge, deadline (rose when <7 days or overdue via `daysSince` and status ≠ COMPLETED), task progress % (done/total from included `tasks[].status`), task count, budget. Card click → `#/projects/{id}`.
- "New project" Dialog: name★, client Select ("None — internal" sentinel → `clientId: ''` coerced to null server-side), type, description, startDate, deadline, budget (omitted when empty so DB stays null).

### ProjectDetailView (workspace)
- Header card: back button, name, type/status badges, description, client chip → `#/clients?selected={clientId}`, start → deadline dates, budget, team avatar stack, inline status `Select` (patch → server logs activity), Edit button.
- Tasks card: 4 kanban columns `md:grid-cols-4` in TASK_STATUS order (labels/colors from `metaOf(TASK_STATUS)`), column lists `max-h-96 overflow-y-auto`; rows show title, priority StatusBadge, deadline (rose if overdue && not DONE), assignee avatar. Header has Progress bar + done/total + "Add task".
- Task Dialog (create/edit): title★, description, priority/status Selects, deadline, notes, assignee Select (Unassigned sentinel), Save + Delete (nested AlertDialog confirm). Save → `api.create/update('tasks', …)`; server auto-logs "Task added"/"Task completed".
- Decisions card: textarea synced from `project.decisions` with dirty-tracked inline Save → `api.update('projects', id, { decisions })`.
- Meetings card: rows (title, purpose, `fmtDateTime`) → `#/meetings?selected={id}`.
- Activity card: `api.list('activities', { projectId })` → `ActivityComposer(projectId)` + `Timeline`.
- Right column: Overview card (progress %, days-to-deadline with overdue state, tasks-by-status mini bars), Files & links card (links JSON → ExternalLink anchors + `AttachmentSection entityType="PROJECT"`).
- Edit dialog (max-w-2xl, scrollable): all fields + team (user checkbox list → JSON userIds array) + links editor (label/url rows → JSON array) + decisions/notes.

### ClientsView
- 3 StatCards: Active, Prospects, Total. Search input (client-side).
- Client cards: name, contactPerson, industry chip, website, email/phone rows, status StatusBadge, notes (line-clamp-2), `_count.projects`. Click → URL-driven detail: `#/clients?selected={id}`.
- Detail Dialog (max-w-2xl, scrollable): all fields editable + Save; "Originated from lead" banner when `leadId` (→ `#/leads/{leadId}`); Projects rows (status badge, task count → `#/projects/{id}`); Meetings rows (→ `#/meetings?selected=`); Contacts rows (→ `#/contacts?selected=`); Open follow-ups with contract-derived status (OVERDUE/DUE_TODAY/UPCOMING) (→ `#/followups`).
- "New client" Dialog: name★, industry, contactPerson, email, phone, status, notes.
- `?selected=` support: derived from `useHashRoute` query prop; closing navigates back to `#/clients` (state lives in the URL — deep-linkable, no effect-based setState).

### ContactsView
- Server-side search (`?q=` — matches name/company per registry), count label, grid of person cards: avatar, name, role · company, icon chips for email/phone/whatsapp/linkedin (mailto/tel/wa.me/LinkedIn links with `stopPropagation`), related badges "Lead: X" / "Client: X" / "SaaS lead: X" (clickable → `#/leads/{id}`, `#/clients?selected={id}`, `#/products?lead={id}`).
- Detail Dialog: view mode (all fields as clickable values, notes, "Connected to" buttons) ↔ Edit mode (all fields incl. socialOther + notes) with Save; `?selected=` support same URL-driven pattern as clients.
- "New contact" Dialog: name★, company, role, email, phone, whatsapp, linkedin, notes.

## Key decisions
- **Dialog selection is URL state** (`#/clients?selected=` / `#/contacts?selected=`) instead of local state + effect: satisfies `?selected=` deep links from other modules (Dashboard, Projects, GlobalSearch), avoids `react-hooks/set-state-in-effect` errors, and closing just navigates back to the bare route.
- **Date inputs round-trip via ISO slice** (`toInputDate` → `yyyy-MM-dd`) so stored UTC dates re-fill `<input type="date">` exactly.
- **Budget omitted when empty** (API `Number()` coercion would turn null/'' into 0; omitting keeps DB null).
- Sentinels for Selects: `none` → `''` → coerced to null by `coerceBody` for clientId/assigneeId.
- Kanban column headers/text colors extracted from canonical `metaOf(TASK_STATUS).color` tokens (no hardcoded label/colors); only the tiny status mini-bars use decorative bar shades (chart, not badge).
- `AttachmentSection` included on project Files & links card (PROJECT entityType) even though project detail include has no attachments — uploads work; listing is a backend gap noted for the main agent (no GET /api/files list endpoint; not fixable within allowed files).
- ProjectsView + ProjectDetailView share query keys (`['projects']`, `['projects', id]`, `['clients']`) with the rest of the app so `qc.invalidateQueries()` stays consistent.

## QA
- `bunx eslint` on all three files: **0 errors/warnings**.
- `bunx tsc --noEmit`: no errors in the three files (remaining project errors pre-exist in other agents'/backend files, untouched).
- dev.log tail: all compiles clean, `/api/crud/*` requests 200.
- Payload shapes verified via API curl (project list has `tasks[].status` + `_count`; detail has client/tasks.assignee/meetings; activities `?projectId=` filter works; contacts `?q=` filter works).
