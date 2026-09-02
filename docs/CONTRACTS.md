# Connec8 OS — Module Implementation Contracts (READ FULLY BEFORE CODING)

You are implementing one or more view modules of **Connec8 OS**, a business operating system for a web/software agency (users: Ahmd & Prasanna). The backend, shell, shared components and Dashboard are DONE and verified. Your job: replace the stub view files with complete, polished module UIs.

## Golden rules

1. **Do NOT modify** any file outside the view file(s) assigned to you (no schema, no API, no shell, no shared components, no layout/page/globals).
2. TypeScript strict, Next.js 16 App Router, React 19. All views are client components: file starts with `'use client'`.
3. Data via `api` client + TanStack Query. Mutations invalidate: `qc.invalidateQueries()`. Toasts via `import { toast } from 'sonner'`.
4. Design: clean command-center. shadcn/ui components (`@/components/ui/*`), Tailwind tokens (`bg-background`, `bg-card`, `text-muted-foreground`, `border`). NO indigo/blue as primary (teal/emerald accents OK). Accent buttons: `className="bg-emerald-600 hover:bg-emerald-700 text-white"`. Rounded-xl cards, `p-4`+ padding, generous whitespace. Desktop-first but responsive (`grid md:grid-cols-…`). NO purple/gradient clutter, no heavy animation (subtle transitions only).
5. Every list needs an EmptyState; every page a `PageHeader`; every status a `StatusBadge`.
6. Loading: skeletons or `loading` prop of StatCard. Errors: `toast.error(e.message)`.
7. Progressive disclosure: show key info first; details in Dialogs or detail views. Minimal forms (the Quick Add dialog handles creation of everything; your "Add" buttons can open QuickAdd via `useUi().openQuickAdd('type')` OR a local richer dialog — prefer richer local dialogs for entity-specific creation inside your module).
8. Long lists: `max-h-96 overflow-y-auto` + `kanban-scroll` class for horizontal scrollers.
9. Run `bun run lint` at the end — must be clean. Do NOT run the dev server, browser, or build. Check errors in `/home/z/my-project/dev.log` after writing code (read last ~40 lines only) and fix runtime errors you caused.

## Router (hash-based)

```tsx
import { useHashRoute } from '@/hooks/use-hash-route'
const { segments, query, navigate } = useHashRoute()
navigate('#/leads/abc123')            // detail page
navigate(`#/products/${pid}?lead=${leadId}`)  // hash query param
```
Routes: `#/dashboard #/leads #/leads/:id #/followups #/outreach #/pitches #/products #/products/:id #/projects #/projects/:id #/clients #/contacts #/meetings #/knowledge #/analytics #/settings`.
Views receive `query?: string` prop when navigated with params — parse with `new URLSearchParams(query)` and react to `selected`, `lead`, `feature`, `client`, `stage` keys.

## API client (`@/lib/api-client`)

```ts
api.list<T>('leads', { stage: 'WON', q: 'bloom' })   // GET /api/crud/leads?stage=WON&q=bloom
api.get<Lead>('leads', id)                           // detail incl. relations (see registry)
api.create('leads', { businessName: '…', … })
api.update('leads', id, { stage: 'CONTACTED' })
api.remove('leads', id)
api.dashboard(query), api.analytics(), api.search(q), api.notifications()
api.upload(file, { entityType: 'LEAD', entityId })   // returns Attachment with .url
```
Entity keys: `leads activities followups outreach pitches products features saas-leads saas-clients clients projects tasks meetings contacts knowledge users`.

Server auto-behaviors (do NOT duplicate): creating/updating records auto-logs Activities (stage changes, follow-up completion, pitch status, feature status, outreach replies…), touches `lastActivityAt`/`nextFollowUpAt`. `features`: PATCH auto-sets `completedAt` on COMPLETED. `followups`: PATCH auto-sets `completedAt`. `clients` create with `leadId` → marks lead WON. `saas-clients` create with `saasLeadId` → funnelStage=CLIENT.

## TS types — `@/lib/types` (Lead, FollowUp, Outreach, Pitch, SaasProduct, SaasFeature, SaasLead, SaasClient, Client, Project, ProjectTask, Meeting, Contact, KnowledgeItem, User, Attachment, DashboardData, AnalyticsData, FunnelStep…). Import and use them.

## Enum metadata — `@/lib/labels` (use with StatusBadge; never hardcode labels/colors)

`LEAD_STAGES` + `LEAD_STAGE_ORDER` (13 stages), `SAAS_FUNNEL_STAGES` + `SAAS_FUNNEL_ORDER` (LEAD→CONTACTED→REPLIED→INTERESTED→DEMO→TRIAL→CLIENT), `PRIORITY`, `FEATURE_STATUS` + `FEATURE_STATUS_ORDER` (9 statuses), `FOLLOWUP_STATUS` (OVERDUE/DUE_TODAY/UPCOMING/COMPLETED/CANCELLED — first two are derived client-side from dueDate), `METHODS`, `OUTREACH_CHANNELS`, `OUTREACH_STATUS` (SENT DELIVERED REPLIED POSITIVE NEGATIVE MEETING_BOOKED NO_RESPONSE), `PITCH_TYPES`, `PITCH_STATUS`, `PROJECT_STATUS` + order, `PROJECT_TYPES`, `TASK_STATUS` (TODO IN_PROGRESS BLOCKED DONE), `CLIENT_STATUS`, `ACTIVITY_TYPES`, `WHY_NOT_COMPLETED` (code→label map), `USER_ROLES`, `LEAD_SOURCES`, `KNOWLEDGE_CATEGORIES`, `EFFORT_WEIGHT` (XS:1 S:2 M:3 L:5 XL:8), `parseJsonArray(s)`, `parseJsonObjects<T>(s)` for JSON-string columns (problems, tags, team, links, participants, actionItems, featuresEnabled).
Helpers: `metaOf(map, key)` → {label,color}.

## Formatting — `@/lib/format`
`fmtDate(d, 'MMM d, yyyy')?`, `fmtDateTime`, `fmtRelative`, `fmtDayLabel` (Today/Tomorrow/…), `daysSince(d)`, `isOverdue(d)`, `initials(name)`, `avatarColor(name)`, `fmtMoney(n)`.

## Shared components (`@/components/shared/*`)

```tsx
<StatusBadge map={LEAD_STAGES} value={lead.stage} size="sm|default" />
<StatCard label="Total Leads" value={n} icon={Users} tone="default|good|warn|bad|accent" sub="optional" loading={bool} />
<EmptyState icon={Users} title="No leads yet" description="…" action={<Button>…</Button>} />
<PageHeader title="Leads" description="…" actions={<Button>…</Button>} />
<Timeline activities={activities} />                       // chronological, icons per type
<ActivityComposer leadId={id} />                            // also: saasLeadId productId clientId projectId
<AttachmentSection entityType="LEAD" entityId={id} attachments={lead.attachments} />  // LEAD SAAS_LEAD SAAS_FEATURE KNOWLEDGE PROJECT CLIENT PRODUCT ACTIVITY
<FunnelBars steps={FunnelStep[]} barTone="bg-teal-600" />   // steps: {stage,label,count,convFromPrev}
```

## Store & QuickAdd (`@/lib/store`)
`useUi()` → `{ currentUserId, setCurrentUserId, openQuickAdd('lead'|'contact'|…), closeQuickAdd, setSearchOpen }`. Use `currentUserId` as default `assignedToId`/`userId`/`creatorId` in create forms.

## Entity field reference (creation payloads; all optional unless ★ required)

- **leads**: businessName★ contactPerson jobTitle website industry location companySize source(GOOGLE_MAPS|LINKEDIN|REFERRAL|WEBSITE|WALK_IN|INSTAGRAM|REDDIT|OTHER) stage priority(LOW|MEDIUM|HIGH|URGENT) whyTargeted pitchAngle problems(json array) notes email phone whatsapp linkedin instagram otherContact nextFollowUpAt(date) assignedToId
- **followups**: title★ dueDate★(datetime) method(EMAIL|WHATSAPP|PHONE|LINKEDIN|INSTAGRAM|VISIT|MEETING|DEMO|OTHER) reason context suggestedNextAction status(UPCOMING|COMPLETED|CANCELLED) leadId saasLeadId clientId productId createdById
- **outreach**: channel★(COLD_EMAIL|LINKEDIN|WHATSAPP|INSTAGRAM|REDDIT|PHONE|REFERRAL|VISIT|OTHER) mode(ONLINE|OFFLINE auto=OFFLINE when channel=VISIT) date message status response followUpRequired(bool) — offline fields: whoMet whatWasDiscussed whatTheySaid problemsIdentified objections featuresLiked featuresRequested interest(YES|NO|MAYBE) nextAction outcome — plus leadId saasLeadId productId userId
- **pitches**: title★ type(WEBSITE_CONCEPT|WEBSITE_REDESIGN|SOFTWARE_IDEA|AI_SOLUTION|LANDING_PAGE|PRESENTATION|PROPOSAL) status(DRAFT|READY|SENT|VIEWED|DISCUSSING|WON|LOST) link notes date creatorId leadId saasLeadId productId
- **products**: name★ tagline description status(ACTIVE|PAUSED|ARCHIVED) accent(hex)
- **features**: name★ productId★ description whyItMatters area priority(LOW|MEDIUM|HIGH|CRITICAL) status(IDEA|RESEARCHING|PLANNED|READY_TO_BUILD|IN_DEVELOPMENT|BLOCKED|TESTING|COMPLETED|REJECTED) effort(XS|S|M|L|XL) weight(int, default 3 — auto-suggest from EFFORT_WEIGHT when effort chosen) dependencies whyNotCompleted(WHY_NOT_COMPLETED keys) blockingDetail nextStep notes dateAdded assigneeId
- **saas-leads**: businessName★ productId★ location contactPerson role phone email website social origin(ONLINE|OFFLINE) funnelStage(SALES funnel keys) interested requirements problems(json) featuresRequested objections feedback questions importantStatements notes nextFollowUpAt
- **saas-clients**: businessName★ productId★ contactPerson email phone plan(TRIAL|BASIC|PRO|ANNUAL) status(TRIAL|ACTIVE|PAUSED|CHURNED) onboardingStatus(NOT_STARTED|IN_PROGRESS|COMPLETED) featuresEnabled(json) customRequirements issues complaints feedback featureRequests notes onboardedAt saasLeadId
- **clients**: name★ industry website contactPerson email phone status(ACTIVE|PROSPECT|COMPLETED|CHURNED) notes leadId
- **projects**: name★ clientId type(WEBSITE|REDESIGN|ECOMMERCE|SOFTWARE|AI|AUTOMATION|INTERNAL|OTHER) description status(PLANNING|DESIGN|DEVELOPMENT|TESTING|CLIENT_REVIEW|COMPLETED) startDate deadline budget(number) team(json userIds) links(json [{label,url}]) decisions notes
- **tasks**: title★ projectId★ description priority(LOW|MEDIUM|HIGH|URGENT) status(TODO|IN_PROGRESS|BLOCKED|DONE) deadline notes assigneeId
- **meetings**: title★ dateTime★ purpose participants(json names) notes decisions actionItems(json [{text,done}]) nextMeetingAt leadId saasLeadId clientId productId projectId
- **contacts**: name★ company role email phone whatsapp linkedin socialOther notes leadId clientId saasLeadId
- **knowledge**: title★ content★ category(RESEARCH|IDEA|BUSINESS|COMPETITOR|SALES|TECHNICAL|RESOURCE|DECISION|GENERAL) tags(json array) link pinned(bool) authorId productId leadId clientId projectId saasLeadId
- **users**: name★ email★ role(ADMIN|FOUNDER|MANAGER|DEVELOPER|DESIGNER|SALES|VIEWER) title

Detail GET relations included: lead→{activities(user),followUps,outreaches,pitches,meetings,contacts,attachments,assignedTo}; saas-leads→{product,followUps,outreaches,pitches,contacts,saasClient,attachments}; products list→each row has `.stats` {progress%, features, byStatus, leads, clients, lastActivityAt}; products/:id→{features(assignee),saasLeads,saasClients,followUps(active),outreaches(20),pitches,knowledge}; clients/:id→{lead,projects,meetings,contacts,followUps}; projects/:id→{client,tasks(assignee),meetings}; leads list supports `?q=&stage=&priority=&source=&assignedToId=`; followups `?leadId=&saasLeadId=&clientId=&productId=&status=&method=`; features `?productId=&status=&priority=`; saas-leads `?productId=&funnelStage=&origin=`; knowledge `?productId=&category=&tag=&q=`; contacts `?q=`.

## UI patterns to follow (consistency with Dashboard)

- Page layout: `<PageHeader/>` then content. Cards `rounded-xl border bg-card` (default Card component OK).
- Filter bars: row of small pill buttons or Select; active pill: `bg-zinc-900 text-white border-zinc-900`, inactive: `bg-background text-muted-foreground hover:bg-muted border`.
- Row lists inside cards: `space-y-1.5`, rows `rounded-lg border px-2.5 py-2 hover:bg-muted/50 transition-colors` as buttons when clickable.
- Table view: shadcn `Table` with `text-sm`; clickable rows navigate.
- Detail dialogs: shadcn `Dialog` `max-w-2xl`, sections with `text-xs font-medium text-muted-foreground` labels. Editing: inline `Input/Textarea/Select` in a Dialog with Save button → `api.update` → toast → invalidate.
- Delete: `AlertDialog` confirm → `api.remove`.
- Derived follow-up status: `isOverdue(f.dueDate) && f.status==='UPCOMING'` → OVERDUE; same-day → DUE_TODAY; else UPCOMING.
- When linking entities show the other side's name (included in payloads).
- Money: `fmtMoney`. Dates: always via format helpers.
- Small text sizes: labels `text-xs`, body `text-sm`, big numbers `text-2xl font-semibold`.
