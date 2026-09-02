'use client'

/**
 * Knowledge module — the agency's shared memory. Masonry card grid with
 * search / category / product / tag filters, a detail dialog (view ⇄ edit ⇄
 * delete) with file attachments, and a "New note" dialog.
 *
 * Deep-linking: `#/knowledge?selected=<id>` opens the detail dialog. The
 * selection is derived from the hash query every render (no setState-in-effect).
 * The detail is fetched with api.get('knowledge', id) because the list payload
 * does not include attachments.
 */

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { useUi } from '@/lib/store'
import { useHashRoute } from '@/hooks/use-hash-route'
import { KnowledgeItem } from '@/lib/types'
import { KNOWLEDGE_CATEGORIES, parseJsonArray } from '@/lib/labels'
import { fmtDate, fmtRelative, initials, avatarColor } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { AttachmentSection } from '@/components/shared/attachment-section'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import {
  BookOpen, ExternalLink, Globe, Layers, Loader2, Pin, Plus, Search, Tag, Trash2, SquarePen,
} from 'lucide-react'

interface PickProduct { id: string; name: string }

function httpsUrl(u?: string | null): string | null {
  if (!u) return null
  return /^https?:\/\//.test(u) ? u : `https://${u}`
}

// ── main view ──

export function KnowledgeView({ query }: { query?: string }) {
  void query // hash query (read via useHashRoute) is the source of truth; prop mirrors it
  const { navigate, query: routeQuery } = useHashRoute()
  const { currentUserId } = useUi()

  const selectedId = routeQuery.get('selected')

  const [q, setQ] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [productFilter, setProductFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)

  const { data: items, isLoading } = useQuery({
    queryKey: ['knowledge'],
    queryFn: () => api.list<KnowledgeItem>('knowledge'),
  })
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => api.list<PickProduct>('products') })

  // top 10 tags across all notes (drives the tag filter chips)
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const it of items || []) for (const t of parseJsonArray(it.tags)) counts.set(t, (counts.get(t) || 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  }, [items])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (items || []).filter((it) => {
      if (category && it.category !== category) return false
      if (productFilter !== 'all' && it.productId !== productFilter) return false
      if (tagFilter && !parseJsonArray(it.tags).some((t) => t.toLowerCase() === tagFilter.toLowerCase())) return false
      if (needle && !it.title.toLowerCase().includes(needle) && !it.content.toLowerCase().includes(needle)) return false
      return true
    })
  }, [items, q, category, productFilter, tagFilter])

  const categoryCount = (key: string) => (items || []).filter((it) => it.category === key).length
  const hasFilters = !!q || !!category || productFilter !== 'all' || !!tagFilter

  return (
    <div>
      <PageHeader
        title="Knowledge"
        description="Shared memory — research, ideas, decisions and technical discoveries."
        actions={
          <Button onClick={() => setNewOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="h-4 w-4" /> New note
          </Button>
        }
      />

      {/* toolbar */}
      <div className="space-y-3 mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search notes…"
              className="h-8 pl-8 text-xs"
              aria-label="Search knowledge"
            />
          </div>
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger size="sm" className="w-[150px] text-xs" aria-label="Filter by product">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All products</SelectItem>
              {(products || []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {filtered.length} of {(items || []).length} notes
          </span>
        </div>

        {/* category pills */}
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => setCategory(null)}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-full border transition-colors',
              !category ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-background text-muted-foreground hover:bg-muted'
            )}
          >
            All
          </button>
          {Object.keys(KNOWLEDGE_CATEGORIES).map((key) => (
            <button
              key={key}
              onClick={() => setCategory(category === key ? null : key)}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-full border transition-colors',
                category === key ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-background text-muted-foreground hover:bg-muted'
              )}
            >
              {KNOWLEDGE_CATEGORIES[key].label}
              <span className={cn('ml-1.5 tabular-nums', category === key ? 'text-zinc-300' : 'text-muted-foreground/70')}>
                {categoryCount(key)}
              </span>
            </button>
          ))}
        </div>

        {/* tag filter chips (top 10) */}
        {tagCounts.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <Tag className="h-3 w-3 text-muted-foreground mr-0.5" aria-hidden />
            {tagCounts.map(([t, n]) => (
              <button
                key={t}
                onClick={() => setTagFilter(tagFilter === t ? null : t)}
                className={cn(
                  'px-2 py-0.5 text-[11px] rounded-full border transition-colors',
                  tagFilter === t
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                )}
              >
                #{t} <span className="tabular-nums opacity-70">{n}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* grid */}
      {isLoading && !items ? (
        <div className="columns-1 md:columns-2 xl:columns-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="break-inside-avoid mb-4 h-40 rounded-xl" />)}
        </div>
      ) : (items || []).length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No knowledge notes yet"
          description="Research, competitor notes, decisions, useful links — if it should outlive a conversation, put it here."
          action={
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setNewOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> New note
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No notes match your filters"
          description={hasFilters ? 'Try clearing the search, category, product or tag filter.' : undefined}
          action={hasFilters ? (
            <Button size="sm" variant="outline" onClick={() => { setQ(''); setCategory(null); setProductFilter('all'); setTagFilter(null) }}>
              Clear filters
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="columns-1 md:columns-2 xl:columns-3 gap-4">
          {filtered.map((it) => {
            const tags = parseJsonArray(it.tags)
            return (
              <article
                key={it.id}
                role="button"
                tabIndex={0}
                aria-label={`Open note: ${it.title}`}
                onClick={() => navigate(`#/knowledge?selected=${it.id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`#/knowledge?selected=${it.id}`) } }}
                className="group break-inside-avoid mb-4 w-full cursor-pointer rounded-xl border bg-card p-4 text-left shadow-xs transition-all hover:shadow-sm hover:border-emerald-300/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <StatusBadge map={KNOWLEDGE_CATEGORIES} value={it.category} size="sm" />
                  {it.pinned && <Pin className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" aria-label="Pinned" />}
                </div>
                <h3 className="mt-2 text-sm font-semibold leading-snug break-words">{it.title}</h3>
                {tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {tags.slice(0, 6).map((t) => (
                      <span key={t} className="rounded-full border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">#{t}</span>
                    ))}
                    {tags.length > 6 && <span className="text-[10px] text-muted-foreground self-center">+{tags.length - 6}</span>}
                  </div>
                )}
                <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap line-clamp-6 break-words">{it.content}</p>
                <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                      style={{ backgroundColor: avatarColor(it.author?.name || it.title) }}
                    >
                      {initials(it.author?.name || '?')}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate">{it.author?.name || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-[10px] text-muted-foreground">
                    {it.product && (
                      <span className="hidden sm:inline-flex items-center gap-1 rounded-full border bg-background px-1.5 py-0.5 max-w-[110px]">
                        <Layers className="h-2.5 w-2.5" /> <span className="truncate">{it.product.name}</span>
                      </span>
                    )}
                    {it.link && (
                      <a
                        href={httpsUrl(it.link) || '#'}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        title={it.link}
                        className="text-teal-600 hover:text-teal-700"
                        aria-label="Open link"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <span title={fmtDate(it.updatedAt)}>{fmtRelative(it.updatedAt)}</span>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* detail dialog (deep-linkable via ?selected=) */}
      {selectedId && (
        <KnowledgeDetail key={selectedId} id={selectedId} onClose={() => navigate('#/knowledge')} />
      )}

      {/* new note dialog */}
      {newOpen && (
        <NewNoteDialog
          products={products}
          currentUserId={currentUserId}
          onClose={() => setNewOpen(false)}
          onCreated={(id) => navigate(`#/knowledge?selected=${id}`)}
        />
      )}
    </div>
  )
}

// ── detail dialog (view ⇄ edit ⇄ delete) ──

function KnowledgeDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { data: item, isLoading } = useQuery({
    queryKey: ['knowledge', id],
    queryFn: () => api.get<KnowledgeItem>('knowledge', id),
  })

  const doDelete = async () => {
    setDeleting(true)
    try {
      await api.remove('knowledge', id)
      toast.success('Note deleted')
      qc.invalidateQueries()
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete note')
      setDeleting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {isLoading || !item ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : editing ? (
          <KnowledgeEditForm key={item.updatedAt} item={item} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge map={KNOWLEDGE_CATEGORIES} value={item.category} size="sm" />
                    {item.pinned && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
                        <Pin className="h-2.5 w-2.5 fill-amber-500" /> Pinned
                      </span>
                    )}
                  </div>
                  <DialogTitle className="text-lg leading-snug mt-1.5 break-words">{item.title}</DialogTitle>
                  <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                    <span>{item.author?.name || 'Unknown'}</span>
                    <span>· updated {fmtRelative(item.updatedAt)}</span>
                    {item.product && <span>· {item.product.name}</span>}
                  </DialogDescription>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button variant="outline" size="sm" className="h-8" onClick={() => setEditing(true)}>
                    <SquarePen className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              {item.link && (
                <a
                  href={httpsUrl(item.link) || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs text-teal-700 hover:bg-muted transition-colors max-w-full"
                >
                  <Globe className="h-3 w-3 shrink-0" />
                  <span className="truncate">{item.link}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              )}

              <section>
                <p className="text-xs font-medium text-muted-foreground mb-1">Content</p>
                <p className="text-sm whitespace-pre-wrap break-words rounded-lg border bg-muted/30 px-3 py-2.5">{item.content}</p>
              </section>

              {parseJsonArray(item.tags).length > 0 && (
                <section>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {parseJsonArray(item.tags).map((t) => (
                      <span key={t} className="rounded-full border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">#{t}</span>
                    ))}
                  </div>
                </section>
              )}

              <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg border px-3 py-2.5">
                <Meta label="Author" value={item.author?.name || '—'} />
                <Meta label="Product" value={item.product?.name || '—'} />
                <Meta label="Created" value={fmtDate(item.createdAt)} />
                <Meta label="Updated" value={fmtRelative(item.updatedAt)} />
              </section>

              <section>
                <AttachmentSection entityType="KNOWLEDGE" entityId={item.id} attachments={item.attachments} />
              </section>
            </div>

            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete “{item.title}”?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the note and its attachments. There is no undo.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => { e.preventDefault(); doDelete() }}
                    disabled={deleting}
                    className="bg-rose-600 hover:bg-rose-700 text-white"
                  >
                    {deleting && <Loader2 className="h-4 w-4 animate-spin" />} Delete note
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xs font-medium truncate">{value}</p>
    </div>
  )
}

// ── edit form (mounted only in edit mode so state initializes from the item) ──

function KnowledgeEditForm({
  item, onDone, onCancel,
}: {
  item: KnowledgeItem
  onDone: () => void
  onCancel: () => void
}) {
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    title: item.title,
    content: item.content,
    category: item.category || 'GENERAL',
    tags: parseJsonArray(item.tags).join(', '),
    link: item.link || '',
    pinned: item.pinned,
  })
  const setField = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return }
    if (!form.content.trim()) { toast.error('Content is required'); return }
    setBusy(true)
    try {
      await api.update('knowledge', item.id, {
        title: form.title.trim(),
        content: form.content,
        category: form.category,
        tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
        link: form.link,
        pinned: form.pinned,
      })
      toast.success('Note updated')
      qc.invalidateQueries()
      onDone()
    } catch (e: any) {
      toast.error(e.message || 'Failed to update note')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit note</DialogTitle>
        <DialogDescription>Update the shared memory — everyone sees the change immediately.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3.5">
        <div className="space-y-1.5">
          <Label className="text-xs">Title *</Label>
          <Input value={form.title} onChange={(e) => setField('title', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Content *</Label>
          <Textarea rows={9} value={form.content} onChange={(e) => setField('content', e.target.value)} className="whitespace-pre-wrap" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Category</Label>
            <Select value={form.category} onValueChange={(v) => setField('category', v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(KNOWLEDGE_CATEGORIES).map(([key, meta]) => (
                  <SelectItem key={key} value={key}>{meta.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tags (comma-separated)</Label>
            <Input value={form.tags} onChange={(e) => setField('tags', e.target.value)} placeholder="pricing, competitor" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Link</Label>
          <Input value={form.link} onChange={(e) => setField('link', e.target.value)} placeholder="https://…" />
        </div>
        <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
          <div>
            <p className="text-sm font-medium">Pinned</p>
            <p className="text-[11px] text-muted-foreground">Keep this note at the top of the board.</p>
          </div>
          <Switch checked={form.pinned} onCheckedChange={(v) => setField('pinned', v)} aria-label="Pin note" />
        </div>
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button onClick={save} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
        </Button>
      </DialogFooter>
    </>
  )
}

// ── new note dialog ──

function NewNoteDialog({
  products, currentUserId, onClose, onCreated,
}: {
  products?: PickProduct[]
  currentUserId: string | null
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    title: '',
    content: '',
    category: 'GENERAL',
    tags: '',
    link: '',
    product: 'none',
    pinned: false,
  })
  const setField = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return }
    if (!form.content.trim()) { toast.error('Content is required'); return }
    setBusy(true)
    try {
      const created = await api.create<KnowledgeItem>('knowledge', {
        title: form.title.trim(),
        content: form.content,
        category: form.category,
        tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
        link: form.link,
        pinned: form.pinned,
        authorId: currentUserId || undefined,
        productId: form.product !== 'none' ? form.product : undefined,
      })
      toast.success('Note saved to shared memory')
      qc.invalidateQueries()
      onCreated(created.id)
    } catch (e: any) {
      toast.error(e.message || 'Failed to create note')
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New note</DialogTitle>
          <DialogDescription>Research, ideas, decisions — write it down so nobody has to remember it.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3.5">
          <div className="space-y-1.5">
            <Label className="text-xs">Title *</Label>
            <Input value={form.title} onChange={(e) => setField('title', e.target.value)} placeholder="DentOS pricing research" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Content *</Label>
            <Textarea rows={6} value={form.content} onChange={(e) => setField('content', e.target.value)} placeholder="What did you learn?" className="whitespace-pre-wrap" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select value={form.category} onValueChange={(v) => setField('category', v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(KNOWLEDGE_CATEGORIES).map(([key, meta]) => (
                    <SelectItem key={key} value={key}>{meta.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tags (comma-separated)</Label>
              <Input value={form.tags} onChange={(e) => setField('tags', e.target.value)} placeholder="pricing, competitor" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Link</Label>
              <Input value={form.link} onChange={(e) => setField('link', e.target.value)} placeholder="https://…" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Product (optional)</Label>
              <Select value={form.product} onValueChange={(v) => setField('product', v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(products || []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Pin to top</p>
              <p className="text-[11px] text-muted-foreground">Important reference? Keep it visible.</p>
            </div>
            <Switch checked={form.pinned} onCheckedChange={(v) => setField('pinned', v)} aria-label="Pin note" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
