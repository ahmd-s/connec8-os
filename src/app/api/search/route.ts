import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Sr = { id: string; title: string; subtitle?: string; href: string }

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim()
  if (q.length < 2) return NextResponse.json([])

  const like = { contains: q }

  try {
    const [leads, saasLeads, clients, saasClients, projects, contacts, pitches, meetings, knowledge, features, products] = await Promise.all([
      db.lead.findMany({ where: { OR: [{ businessName: like }, { contactPerson: like }, { whyTargeted: like }, { industry: like }] }, take: 5, select: { id: true, businessName: true, contactPerson: true, industry: true } }),
      db.saasLead.findMany({ where: { OR: [{ businessName: like }, { contactPerson: like }, { notes: like }] }, take: 5, select: { id: true, businessName: true, contactPerson: true, productId: true } }),
      db.client.findMany({ where: { OR: [{ name: like }, { contactPerson: like }, { industry: like }] }, take: 5, select: { id: true, name: true, industry: true } }),
      db.saasClient.findMany({ where: { OR: [{ businessName: like }, { contactPerson: like }] }, take: 5, select: { id: true, businessName: true, plan: true, productId: true } }),
      db.project.findMany({ where: { OR: [{ name: like }, { description: like }] }, take: 5, select: { id: true, name: true, status: true } }),
      db.contact.findMany({ where: { OR: [{ name: like }, { company: like }, { role: like }] }, take: 5, select: { id: true, name: true, company: true } }),
      db.pitch.findMany({ where: { OR: [{ title: like }, { notes: like }] }, take: 5, select: { id: true, title: true, status: true } }),
      db.meeting.findMany({ where: { OR: [{ title: like }, { purpose: like }, { notes: like }] }, take: 5, select: { id: true, title: true, dateTime: true } }),
      db.knowledgeItem.findMany({ where: { OR: [{ title: like }, { content: like }] }, take: 5, select: { id: true, title: true, category: true } }),
      db.saasFeature.findMany({ where: { OR: [{ name: like }, { description: like }] }, take: 5, select: { id: true, name: true, productId: true, status: true } }),
      db.saasProduct.findMany({ where: { OR: [{ name: like }, { description: like }, { tagline: like }] }, take: 5, select: { id: true, name: true, tagline: true } }),
    ])

    const groups: { type: string; label: string; items: Sr[] }[] = []
    const push = (type: string, label: string, items: Sr[]) => { if (items.length) groups.push({ type, label, items }) }

    push('lead', 'Leads', leads.map((l) => ({ id: l.id, title: l.businessName, subtitle: l.contactPerson || l.industry || undefined, href: `#/leads/${l.id}` })))
    push('saas_lead', 'SaaS Leads', saasLeads.map((l) => ({ id: l.id, title: l.businessName, subtitle: l.contactPerson || undefined, href: `#/products/${l.productId}?lead=${l.id}` })))
    push('product', 'Products & SaaS', products.map((p) => ({ id: p.id, title: p.name, subtitle: p.tagline || undefined, href: `#/products/${p.id}` })))
    push('feature', 'Features', features.map((f) => ({ id: f.id, title: f.name, subtitle: f.status.replaceAll('_', ' ').toLowerCase(), href: `#/products/${f.productId}?feature=${f.id}` })))
    push('client', 'Clients', clients.map((c) => ({ id: c.id, title: c.name, subtitle: c.industry || undefined, href: `#/clients?selected=${c.id}` })))
    push('saas_client', 'SaaS Clients', saasClients.map((c) => ({ id: c.id, title: c.businessName, subtitle: c.plan || undefined, href: `#/products/${c.productId}?client=${c.id}` })))
    push('project', 'Projects', projects.map((p) => ({ id: p.id, title: p.name, subtitle: p.status.replaceAll('_', ' ').toLowerCase(), href: `#/projects/${p.id}` })))
    push('contact', 'Contacts', contacts.map((c) => ({ id: c.id, title: c.name, subtitle: c.company || undefined, href: `#/contacts?selected=${c.id}` })))
    push('pitch', 'Pitches', pitches.map((p) => ({ id: p.id, title: p.title, subtitle: p.status.toLowerCase(), href: `#/pitches?selected=${p.id}` })))
    push('meeting', 'Meetings', meetings.map((m) => ({ id: m.id, title: m.title, subtitle: new Date(m.dateTime).toLocaleDateString(), href: `#/meetings?selected=${m.id}` })))
    push('knowledge', 'Knowledge', knowledge.map((k) => ({ id: k.id, title: k.title, subtitle: k.category.toLowerCase(), href: `#/knowledge?selected=${k.id}` })))

    return NextResponse.json(groups)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Search failed' }, { status: 500 })
  }
}
