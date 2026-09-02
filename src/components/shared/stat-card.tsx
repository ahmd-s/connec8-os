'use client'

import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/** Metric tile used across Dashboard / SaaS workspace / Analytics. */
export function StatCard({
  label, value, sub, icon: Icon, tone = 'default', className, loading,
}: {
  label: string
  value: string | number
  sub?: string
  icon?: React.ComponentType<{ className?: string }>
  tone?: 'default' | 'good' | 'warn' | 'bad' | 'accent'
  className?: string
  loading?: boolean
}) {
  const tones: Record<string, string> = {
    default: 'text-foreground',
    good: 'text-emerald-600',
    warn: 'text-amber-600',
    bad: 'text-rose-600',
    accent: 'text-teal-600',
  }
  const iconTones: Record<string, string> = {
    default: 'bg-zinc-100 text-zinc-600',
    good: 'bg-emerald-50 text-emerald-600',
    warn: 'bg-amber-50 text-amber-600',
    bad: 'bg-rose-50 text-rose-600',
    accent: 'bg-teal-50 text-teal-600',
  }
  return (
    <Card className={cn('p-4 flex flex-col gap-1', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {Icon && (
          <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-md', iconTones[tone])}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton className="h-7 w-16" />
      ) : (
        <span className={cn('text-2xl font-semibold tracking-tight leading-none', tones[tone])}>{value}</span>
      )}
      {sub && <span className="text-[11px] text-muted-foreground mt-0.5">{sub}</span>}
    </Card>
  )
}
