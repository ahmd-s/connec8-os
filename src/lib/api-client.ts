/** Connec8 OS — typed API client. Every view uses this; no raw fetch elsewhere. */

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try { const j = await res.json(); if (j?.error) msg = j.error } catch { /* ignore */ }
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

export const api = {
  list<T = any>(entity: string, params: Record<string, string | undefined> = {}): Promise<T[]> {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v) })
    const q = qs.toString()
    return fetch(`/api/crud/${entity}${q ? `?${q}` : ''}`).then((r) => handle<T[]>(r))
  },
  get<T = any>(entity: string, id: string): Promise<T> {
    return fetch(`/api/crud/${entity}/${id}`).then((r) => handle<T>(r))
  },
  create<T = any>(entity: string, data: any): Promise<T> {
    return fetch(`/api/crud/${entity}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }).then((r) => handle<T>(r))
  },
  update<T = any>(entity: string, id: string, data: any): Promise<T> {
    return fetch(`/api/crud/${entity}/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }).then((r) => handle<T>(r))
  },
  remove(entity: string, id: string): Promise<void> {
    return fetch(`/api/crud/${entity}/${id}`, { method: 'DELETE' }).then((r) => handle<void>(r))
  },

  dashboard(query?: string): Promise<import('./types').DashboardData> {
    return fetch(`/api/dashboard${query ? `?${query}` : ''}`).then((r) => handle(r))
  },
  analytics(): Promise<import('./types').AnalyticsData> {
    return fetch('/api/analytics').then((r) => handle(r))
  },
  search(q: string): Promise<import('./types').SearchGroup[]> {
    return fetch(`/api/search?q=${encodeURIComponent(q)}`).then((r) => handle(r))
  },
  notifications(): Promise<{ count: number; items: import('./types').AttentionItem[] }> {
    return fetch('/api/notifications').then((r) => handle(r))
  },

  upload(file: File, meta: { entityType: string; entityId: string }): Promise<import('./types').Attachment> {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('entityType', meta.entityType)
    fd.append('entityId', meta.entityId)
    return fetch('/api/files', { method: 'POST', body: fd }).then((r) => handle(r))
  },
}

export type Api = typeof api
