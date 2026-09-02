'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { useHashRoute } from '@/hooks/use-hash-route'
import { Contact } from '@/lib/types'
import { initials, avatarColor } from '@/lib/format'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  BookUser, Plus, Search, Mail, Phone, MessageCircle, Linkedin, ChevronRight,
  Loader2, Pencil, Building2, ExternalLink,
} from 'lucide-react'

type ContactForm = {
  name: string
  company: string
  role: string
  email: string
  phone: string
  whatsapp: string
  linkedin: string
  socialOther: string
  notes: string
}

const EMPTY_FORM: ContactForm = {
  name: '', company: '', role: '', email: '', phone: '', whatsapp: '', linkedin: '', socialOther: '', notes: '',
}

export function ContactsView({ query }: { query?: string }) {
  const { navigate } = useHashRoute()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['contacts', search],
    queryFn: () => api.list<Contact>('contacts', { q: search }),
  })

  // selection lives in the URL: #/contacts?selected=<id> opens the detail dialog
  const selected = useMemo(() => new URLSearchParams(query || '').get('selected'), [query])

  const all = useMemo(() => contacts || [], [contacts])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts"
        description="People and relationship history, connected to everything they touch."
        actions={
          <Button onClick={() => setCreateOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="h-4 w-4" /> New contact
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people & companies…" className="h-8 pl-8 text-xs"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {isLoading ? 'Loading…' : `${all.length} contact${all.length === 1 ? '' : 's'}`}
        </span>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : all.length === 0 ? (
        <EmptyState
          icon={BookUser}
          title={search ? 'No contacts match your search' : 'No contacts yet'}
          description={search ? 'Try a different name or company.' : 'Save the people you meet — every contact stays linked to their lead, client or SaaS account.'}
          action={
            <Button onClick={() => setCreateOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="h-4 w-4" /> New contact
            </Button>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {all.map((c) => {
            const noChannels = !c.email && !c.phone && !c.whatsapp && !c.linkedin
            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`#/contacts?selected=${c.id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(`#/contacts?selected=${c.id}`) }}
                className="rounded-xl border bg-card p-4 hover:border-emerald-300 hover:shadow-sm transition-all cursor-pointer group flex flex-col gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <div className="flex items-start gap-2.5">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback style={{ background: avatarColor(c.name) }} className="text-xs text-white">
                      {initials(c.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate group-hover:text-emerald-700 transition-colors">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[c.role, c.company].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                </div>

                {/* channel chips */}
                <div className="flex flex-wrap gap-1.5">
                  {c.email && (
                    <a
                      href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()}
                      title={c.email}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground hover:text-emerald-700 hover:border-emerald-300 transition-colors"
                    >
                      <Mail className="h-3 w-3" />
                    </a>
                  )}
                  {c.phone && (
                    <a
                      href={`tel:${c.phone.replace(/\s+/g, '')}`} onClick={(e) => e.stopPropagation()}
                      title={c.phone}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground hover:text-emerald-700 hover:border-emerald-300 transition-colors"
                    >
                      <Phone className="h-3 w-3" />
                    </a>
                  )}
                  {c.whatsapp && (
                    <a
                      href={`https://wa.me/${c.whatsapp.replace(/[^\d]/g, '')}`} target="_blank" rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title={`WhatsApp ${c.whatsapp}`}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground hover:text-emerald-700 hover:border-emerald-300 transition-colors"
                    >
                      <MessageCircle className="h-3 w-3" />
                    </a>
                  )}
                  {c.linkedin && (
                    <a
                      href={c.linkedin} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                      title={c.linkedin}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground hover:text-emerald-700 hover:border-emerald-300 transition-colors"
                    >
                      <Linkedin className="h-3 w-3" />
                    </a>
                  )}
                  {noChannels && <span className="text-[11px] text-muted-foreground">No contact channels added</span>}
                </div>

                {/* related records */}
                {(c.lead || c.client || c.saasLead) && (
                  <div className="flex flex-wrap gap-1.5">
                    {c.lead && <RelatedBadge label={`Lead: ${c.lead.businessName}`} onClick={() => navigate(`#/leads/${c.lead!.id}`)} />}
                    {c.client && <RelatedBadge label={`Client: ${c.client.name}`} onClick={() => navigate(`#/clients?selected=${c.client!.id}`)} />}
                    {c.saasLead && <RelatedBadge label={`SaaS lead: ${c.saasLead.businessName}`} onClick={() => navigate(`#/products?lead=${c.saasLead!.id}`)} />}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ContactDetailDialog id={selected} open={!!selected} onOpenChange={(o) => { if (!o) navigate('#/contacts') }} />
      <CreateContactDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}

/* ── related badge (clickable, stops card navigation) ── */

function RelatedBadge({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className="inline-flex items-center gap-0.5 rounded-full border bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-emerald-700 hover:border-emerald-300 transition-colors"
    >
      {label} <ChevronRight className="h-2.5 w-2.5" />
    </button>
  )
}

/* ── create dialog ── */

function CreateContactDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) setForm(EMPTY_FORM) }, [open])

  const set = (k: keyof ContactForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    if (!form.name.trim()) { toast.error('Contact name is required'); return }
    setSaving(true)
    try {
      await api.create('contacts', { ...form, name: form.name.trim() })
      toast.success('Contact added')
      qc.invalidateQueries()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message || 'Failed to create contact')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">New contact</DialogTitle>
          <DialogDescription className="text-xs">A person worth remembering — link them to leads, clients or SaaS accounts later.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Name <span className="text-rose-500">*</span></Label>
            <Input value={form.name} onChange={set('name')} placeholder="e.g. Nadia Fernando" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Company</Label>
              <Input value={form.company} onChange={set('company')} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Input value={form.role} onChange={set('role')} placeholder="e.g. Co-owner" className="text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={form.email} onChange={set('email')} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input value={form.phone} onChange={set('phone')} className="text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">WhatsApp</Label>
              <Input value={form.whatsapp} onChange={set('whatsapp')} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">LinkedIn</Label>
              <Input value={form.linkedin} onChange={set('linkedin')} placeholder="https://linkedin.com/in/…" className="text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea value={form.notes} onChange={set('notes')} placeholder="How you met, what they care about, context…" className="min-h-[60px] text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Add contact
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ── detail dialog (view ↔ edit) ── */

function ContactDetailDialog({
  id, open, onOpenChange,
}: {
  id: string | null
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { navigate } = useHashRoute()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM)

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contacts', id],
    queryFn: () => api.get<Contact>('contacts', id!),
    enabled: open && !!id,
  })

  useEffect(() => {
    if (contact) {
      setForm({
        name: contact.name,
        company: contact.company || '',
        role: contact.role || '',
        email: contact.email || '',
        phone: contact.phone || '',
        whatsapp: contact.whatsapp || '',
        linkedin: contact.linkedin || '',
        socialOther: contact.socialOther || '',
        notes: contact.notes || '',
      })
    }
  }, [contact])

  useEffect(() => { if (!open) setEditing(false) }, [open])

  const set = (k: keyof ContactForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    if (!contact) return
    if (!form.name.trim()) { toast.error('Contact name is required'); return }
    setSaving(true)
    try {
      await api.update('contacts', contact.id, { ...form, name: form.name.trim() })
      toast.success('Contact updated')
      qc.invalidateQueries()
      setEditing(false)
    } catch (e: any) {
      toast.error(e.message || 'Failed to update contact')
    } finally {
      setSaving(false)
    }
  }

  const go = (hash: string) => {
    onOpenChange(false)
    navigate(hash)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            {contact ? (
              <Avatar className="h-6 w-6">
                <AvatarFallback style={{ background: avatarColor(contact.name) }} className="text-[9px] text-white">
                  {initials(contact.name)}
                </AvatarFallback>
              </Avatar>
            ) : (
              <BookUser className="h-4 w-4 text-teal-600" />
            )}
            {isLoading ? 'Contact' : contact?.name || 'Contact'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {contact ? [contact.role, contact.company].filter(Boolean).join(' · ') || 'Person' : 'Loading…'}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !contact ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Name <span className="text-rose-500">*</span></Label>
                <Input value={form.name} onChange={set('name')} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Company</Label>
                <Input value={form.company} onChange={set('company')} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Role</Label>
                <Input value={form.role} onChange={set('role')} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={form.email} onChange={set('email')} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input value={form.phone} onChange={set('phone')} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">WhatsApp</Label>
                <Input value={form.whatsapp} onChange={set('whatsapp')} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">LinkedIn</Label>
                <Input value={form.linkedin} onChange={set('linkedin')} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Other social</Label>
                <Input value={form.socialOther} onChange={set('socialOther')} className="text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea value={form.notes} onChange={set('notes')} className="min-h-[70px] text-sm" />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setEditing(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save changes
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {/* channels */}
            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              <ViewField label="Company" value={contact.company} />
              <ViewField label="Role" value={contact.role} />
              <ViewField label="Email" value={contact.email} href={contact.email ? `mailto:${contact.email}` : undefined} />
              <ViewField label="Phone" value={contact.phone} href={contact.phone ? `tel:${contact.phone.replace(/\s+/g, '')}` : undefined} />
              <ViewField
                label="WhatsApp"
                value={contact.whatsapp}
                href={contact.whatsapp ? `https://wa.me/${contact.whatsapp.replace(/[^\d]/g, '')}` : undefined}
              />
              <ViewField
                label="LinkedIn"
                value={contact.linkedin ? contact.linkedin.replace(/^https?:\/\/(www\.)?/, '') : undefined}
                href={contact.linkedin || undefined}
              />
              <ViewField label="Other social" value={contact.socialOther} href={contact.socialOther || undefined} />
            </div>

            {contact.notes && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                <p className="text-sm whitespace-pre-wrap break-words rounded-lg border bg-muted/20 p-3">{contact.notes}</p>
              </div>
            )}

            {/* related records */}
            {(contact.lead || contact.client || contact.saasLead) && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Connected to</p>
                <div className="flex flex-wrap gap-1.5">
                  {contact.lead && (
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => go(`#/leads/${contact.lead!.id}`)}>
                      Lead: {contact.lead.businessName} <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                  {contact.client && (
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => go(`#/clients?selected=${contact.client!.id}`)}>
                      <Building2 className="h-3 w-3" /> Client: {contact.client.name}
                    </Button>
                  )}
                  {contact.saasLead && (
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => go(`#/products?lead=${contact.saasLead!.id}`)}>
                      SaaS lead: {contact.saasLead.businessName} <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground">
              Keep this person linked to their lead, client or SaaS account so context never gets lost.
            </p>
          </div>
        )}

        {!editing && contact && (
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ── read-only field row ── */

function ViewField({ label, value, href }: { label: string; value?: string | null; href?: string }) {
  if (!value) return null
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      {href ? (
        <a
          href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer"
          className="text-sm font-medium truncate block hover:text-emerald-700 transition-colors"
        >
          {value}
        </a>
      ) : (
        <p className="text-sm font-medium truncate">{value}</p>
      )}
    </div>
  )
}
