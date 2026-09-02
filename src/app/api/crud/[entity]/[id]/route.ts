import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRegistry, coerceBody } from '@/lib/crud-registry'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ entity: string; id: string }> }) {
  const { entity, id } = await params
  const cfg = getRegistry(entity)
  if (!cfg) return NextResponse.json({ error: `Unknown entity: ${entity}` }, { status: 404 })
  try {
    const delegate = (db as any)[cfg.model]
    const row = await delegate.findUnique({
      where: { id },
      include: cfg.detailInclude || cfg.listInclude,
    })
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(row)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Get failed' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ entity: string; id: string }> }) {
  const { entity, id } = await params
  const cfg = getRegistry(entity)
  if (!cfg) return NextResponse.json({ error: `Unknown entity: ${entity}` }, { status: 404 })
  try {
    const body = await req.json()
    const res = coerceBody(cfg, body, { partial: true })
    if ('error' in res) return NextResponse.json({ error: res.error }, { status: 400 })
    const delegate = (db as any)[cfg.model]

    // auto-timestamps around status semantics
    if (entity === 'features' && res.data.status) {
      res.data.completedAt = res.data.status === 'COMPLETED' ? new Date() : null
    }
    if (entity === 'followups' && res.data.status) {
      res.data.completedAt = res.data.status === 'COMPLETED' ? new Date() : null
    }

    const before = await delegate.findUnique({ where: { id } })
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const after = await delegate.update({ where: { id }, data: res.data, include: cfg.listInclude })
    if (cfg.afterUpdate) await cfg.afterUpdate(before, after, res.data)
    return NextResponse.json(after)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ entity: string; id: string }> }) {
  const { entity, id } = await params
  const cfg = getRegistry(entity)
  if (!cfg) return NextResponse.json({ error: `Unknown entity: ${entity}` }, { status: 404 })
  try {
    if (cfg.beforeDelete) await cfg.beforeDelete(id)
    const delegate = (db as any)[cfg.model]
    await delegate.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Delete failed' }, { status: 500 })
  }
}
