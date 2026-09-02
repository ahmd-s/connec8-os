import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRegistry, coerceBody } from '@/lib/crud-registry'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params
  const cfg = getRegistry(entity)
  if (!cfg) return NextResponse.json({ error: `Unknown entity: ${entity}` }, { status: 404 })
  try {
    const sp = req.nextUrl.searchParams
    const where = cfg.listWhere ? cfg.listWhere(sp) : {}
    const delegate = (db as any)[cfg.model]
    let rows = await delegate.findMany({
      where,
      include: cfg.listInclude,
      orderBy: cfg.orderBy || { createdAt: 'desc' },
    })
    if (cfg.postFilter) rows = cfg.postFilter(rows, sp)
    if (cfg.listTransform) rows = await Promise.resolve(cfg.listTransform(rows, sp))
    return NextResponse.json(rows)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'List failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params
  const cfg = getRegistry(entity)
  if (!cfg) return NextResponse.json({ error: `Unknown entity: ${entity}` }, { status: 404 })
  try {
    const body = await req.json()
    const res = coerceBody(cfg, body, { partial: false })
    if ('error' in res) return NextResponse.json({ error: res.error }, { status: 400 })
    const delegate = (db as any)[cfg.model]
    const created = await delegate.create({ data: res.data, include: cfg.listInclude })
    if (cfg.afterCreate) await cfg.afterCreate(created, res.data)
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Create failed' }, { status: 500 })
  }
}
