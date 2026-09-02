'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { ACTIVITY_TYPES } from '@/lib/labels'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

const QUICK_TYPES = ['NOTE', 'CALL', 'EMAIL_SENT', 'WHATSAPP_SENT', 'LINKEDIN_SENT', 'VISIT', 'DEMO', 'REPLY', 'MEETING', 'RESEARCH']

/**
 * Quick composer: pick a type, write what happened, hit log.
 * Attach to any detail page with the right entity ids.
 */
export function ActivityComposer({
  leadId, saasLeadId, productId, clientId, projectId, className,
}: {
  leadId?: string
  saasLeadId?: string
  productId?: string
  clientId?: string
  projectId?: string
  className?: string
}) {
  const qc = useQueryClient()
  const [type, setType] = useState('NOTE')
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!text.trim()) { toast.error('Write what happened first'); return }
    setSaving(true)
    try {
      await api.create('activities', {
        type, description: text.trim(),
        leadId, saasLeadId, productId, clientId, projectId,
      })
      setText('')
      toast.success('Activity logged')
      qc.invalidateQueries()
    } catch (e: any) {
      toast.error(e.message || 'Failed to log activity')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cn('rounded-xl border bg-muted/30 p-3', className)}>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {QUICK_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={cn(
              'text-[11px] px-2 py-1 rounded-full border transition-colors',
              type === t ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-background text-muted-foreground hover:bg-accent'
            )}
          >
            {ACTIVITY_TYPES[t]?.label || t}
          </button>
        ))}
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What happened? Log it so nobody has to remember it…"
        className="min-h-[64px] bg-background text-sm"
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-muted-foreground">⌘↵ to save</span>
        <Button size="sm" onClick={submit} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Log activity
        </Button>
      </div>
    </div>
  )
}
