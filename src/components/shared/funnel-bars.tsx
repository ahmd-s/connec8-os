'use client'

import { FunnelStep } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * Horizontal funnel bars with stage counts + conversion percentages.
 * Used in Analytics and per-SaaS sales funnels.
 */
export function FunnelBars({
  steps, className, barTone = 'bg-teal-600',
}: {
  steps: FunnelStep[]
  className?: string
  barTone?: string
}) {
  const max = Math.max(...steps.map((s) => s.count), 1)
  return (
    <div className={cn('space-y-3', className)}>
      {steps.map((s, i) => (
        <div key={s.stage} className="group">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <span className="text-xs font-medium">{s.label}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {s.count}
              {s.convFromPrev !== null && (
                <span className={cn('ml-2', s.convFromPrev >= 50 ? 'text-emerald-600' : s.convFromPrev >= 25 ? 'text-amber-600' : 'text-rose-500')}>
                  {s.convFromPrev}%
                </span>
              )}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', barTone)}
              style={{ width: `${Math.max((s.count / max) * 100, s.count > 0 ? 4 : 0)}%` }}
            />
          </div>
          {i < steps.length - 1 && steps[i + 1].count < s.count && s.count > 0 && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {s.count - steps[i + 1].count} lost between {s.label.toLowerCase()} and {steps[i + 1].label.toLowerCase()}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
