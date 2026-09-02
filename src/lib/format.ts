import { format, formatDistanceToNow, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns'

export function fmtDate(d?: string | Date | null, pattern = 'MMM d, yyyy'): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? parseISO(d) : d
  if (isNaN(date.getTime())) return '—'
  return format(date, pattern)
}

export function fmtDateTime(d?: string | Date | null): string {
  return fmtDate(d, 'MMM d, yyyy · h:mm a')
}

export function fmtRelative(d?: string | Date | null): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? parseISO(d) : d
  if (isNaN(date.getTime())) return '—'
  return formatDistanceToNow(date, { addSuffix: true })
}

export function fmtDayLabel(d?: string | Date | null): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? parseISO(d) : d
  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEE, MMM d')
}

export function daysSince(d?: string | Date | null): number {
  if (!d) return 0
  const date = typeof d === 'string' ? parseISO(d) : d
  return Math.floor((Date.now() - date.getTime()) / 86_400_000)
}

export function isOverdue(d?: string | Date | null): boolean {
  if (!d) return false
  const date = typeof d === 'string' ? parseISO(d) : d
  return date.getTime() < Date.now()
}

export function initials(name: string): string {
  return name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

export function avatarColor(name: string): string {
  const palette = ['#0d9488', '#b45309', '#be185d', '#7c3aed', '#0369a1', '#15803d', '#b91c1c', '#a16207']
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
}

export function fmtMoney(n?: number | null): string {
  if (n === null || n === undefined) return '—'
  return `$${n.toLocaleString()}`
}
