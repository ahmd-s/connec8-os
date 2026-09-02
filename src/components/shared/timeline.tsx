'use client'

import { Activity } from '@/lib/types'
import { ACTIVITY_TYPES, metaOf } from '@/lib/labels'
import { fmtDate, fmtRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  Search, Globe, Mail, MessageCircle, Linkedin, Phone, MapPin, Users, Presentation,
  AlarmClock, CheckCircle2, FileText, Reply, StickyNote, ArrowRightLeft, Mic, Eye, Wrench, CalendarPlus,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { avatarColor } from '@/lib/format'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LEAD_DISCOVERED: Search, RESEARCH: Globe, WEBSITE_ANALYSED: Globe,
  PITCH_CREATED: Presentation, EMAIL_SENT: Mail, WHATSAPP_SENT: MessageCircle,
  LINKEDIN_SENT: Linkedin, CALL: Phone, VISIT: MapPin, VISIT_LOGGED: MapPin,
  MEETING: Users, DEMO: Presentation, FOLLOW_UP: AlarmClock, FOLLOW_UP_DONE: CheckCircle2,
  PROPOSAL: FileText, REPLY: Reply, NOTE: StickyNote, STAGE_CHANGED: ArrowRightLeft,
  PITCH_STATUS: Eye, FEATURE_UPDATE: Wrench, OUTREACH: Mail, TASK: CheckCircle2, OTHER: StickyNote,
}

/**
 * Chronological activity timeline (newest first) with icons, author, date.
 * Used in lead detail, SaaS lead detail, product overview, project detail.
 */
export function Timeline({
  activities, className, emptyText = 'No activity yet — everything logged here will appear on this timeline.',
}: {
  activities: Activity[]
  className?: string
  emptyText?: string
}) {
  const sorted = [...(activities || [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
  if (!sorted.length) {
    return <p className="text-xs text-muted-foreground py-6 text-center">{emptyText}</p>
  }
  return (
    <div className={cn('relative space-y-0', className)}>
      {sorted.map((a, i) => {
        const Icon = ICONS[a.type] || StickyNote
        const meta = metaOf(ACTIVITY_TYPES, a.type)
        const last = i === sorted.length - 1
        return (
          <div key={a.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!last && <span className="absolute left-[15px] top-8 bottom-0 w-px bg-border" aria-hidden />}
            <span className={cn('relative z-10 mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background', meta.color)}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1 -mt-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                {a.title && <p className="text-sm font-medium leading-5">{a.title}</p>}
                <span className="text-[11px] text-muted-foreground">
                  {fmtDate(a.date, 'MMM d')} · {fmtRelative(a.date)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-5 mt-0.5 whitespace-pre-wrap break-words">{a.description}</p>
              {a.user && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Avatar className="h-4 w-4">
                    <AvatarFallback style={{ background: avatarColor(a.user.name) }} className="text-[7px] text-white">
                      {a.user.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[11px] text-muted-foreground">{a.user.name}</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
