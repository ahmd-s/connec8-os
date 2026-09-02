/**
 * Connec8 OS — Database Seed
 * Rich, realistic data so the OS feels alive from first launch.
 * Dates are relative to "now" so dashboards always demonstrate
 * overdue / due-today / upcoming states correctly.
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const now = () => new Date()
const daysAgo = (n: number, h = 10) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, 0, 0, 0); return d }
const daysFromNow = (n: number, h = 10) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d }
const hoursFromNow = (n: number) => new Date(Date.now() + n * 3600_000)

async function main() {
  console.log('Seeding Connec8 OS…')

  // wipe (order matters)
  await db.attachment.deleteMany()
  await db.activity.deleteMany()
  await db.projectTask.deleteMany()
  await db.meeting.deleteMany()
  await db.project.deleteMany()
  await db.saasClient.deleteMany()
  await db.saasFeature.deleteMany()
  await db.saasLead.deleteMany()
  await db.knowledgeItem.deleteMany()
  await db.pitch.deleteMany()
  await db.outreach.deleteMany()
  await db.followUp.deleteMany()
  await db.contact.deleteMany()
  await db.client.deleteMany()
  await db.lead.deleteMany()
  await db.saasProduct.deleteMany()
  await db.user.deleteMany()

  // ── Users ──
  const ahmd = await db.user.create({ data: { name: 'Ahmd', email: 'ahmd@connec8.com', role: 'ADMIN', title: 'Co-founder — Product & Engineering' } })
  const prasanna = await db.user.create({ data: { name: 'Prasanna', email: 'prasanna@connec8.com', role: 'FOUNDER', title: 'Co-founder — Sales & Growth' } })

  // ── Agency Leads ──
  const bloom = await db.lead.create({ data: {
    businessName: 'Bloom & Co Furniture', contactPerson: 'Nadia Fernando', jobTitle: 'Owner', website: 'https://bloomandco.lk', industry: 'Furniture & Interior', location: 'Colombo 05', companySize: '11-50',
    source: 'GOOGLE_MAPS', stage: 'WON', priority: 'HIGH',
    whyTargeted: 'Ranks #1 on Google for "luxury furniture Colombo" but the website is a 2014-era template — products not visible on mobile at all.',
    pitchAngle: 'Premium catalogue-style website with WhatsApp quote requests, matching their showroom experience.',
    problems: JSON.stringify(['Outdated website', 'Poor mobile experience', 'No lead capture']),
    email: 'nadia@bloomandco.lk', phone: '+94 77 231 4455', whatsapp: '+94 77 231 4455', instagram: '@bloomandco.lk',
    notes: 'Slow decision maker but genuinely cares about brand image. Wife co-owns, she handles Instagram.',
    assignedToId: prasanna.id, lastActivityAt: daysAgo(18), nextFollowUpAt: null,
  }})
  const serene = await db.lead.create({ data: {
    businessName: 'Serene Dental Spa', contactPerson: 'Dr. Malik Jayawardena', jobTitle: 'Founder & Dentist', website: 'https://serenedental-spa.com', industry: 'Healthcare', location: 'Colombo 07', companySize: '5-10',
    source: 'LINKEDIN', stage: 'ACTIVE_CONVERSATION', priority: 'HIGH',
    whyTargeted: 'Premium dental spa with strong Instagram presence but website link in bio is broken — losing bookings.',
    pitchAngle: 'Elegant site with online appointment booking integrated to their Instagram bio.',
    problems: JSON.stringify(['Expired website', 'No booking system']),
    email: 'info@serenedental-spa.com', whatsapp: '+94 76 552 8891', linkedin: 'in/malik-jayawardena', instagram: '@serenedental',
    notes: 'Replied positively to first email. Asked for portfolio of medical clients.',
    assignedToId: prasanna.id, lastActivityAt: daysAgo(4),
  }})
  const lanka = await db.lead.create({ data: {
    businessName: 'Lanka Tea Exporters', contactPerson: 'Ruwan Perera', jobTitle: 'Director', website: 'https://lankateaexport.com', industry: 'Export / Trading', location: 'Kandy', companySize: '50-200',
    source: 'REFERRAL', stage: 'PROPOSAL_SENT', priority: 'URGENT',
    whyTargeted: 'Referred by Priya (existing client). Their buyer portal is manual — PDF price lists emailed weekly.',
    pitchAngle: 'B2B portal with live pricing, order tracking and document vault for international buyers.',
    problems: JSON.stringify(['Manual processes', 'Outdated website', 'Software opportunity']),
    email: 'ruwan@lankateaexport.com', phone: '+94 81 220 3344', linkedin: 'in/ruwan-perera',
    notes: 'Budget cycle ends end of September — decision expected by then. Referred by Priya at Ceylon Spice Co.',
    assignedToId: ahmd.id, lastActivityAt: daysAgo(2),
  }})
  const fitzone = await db.lead.create({ data: {
    businessName: 'FitZone Gym', contactPerson: 'Dinesh Silva', jobTitle: 'Manager', website: 'https://fitzonegym.lk', industry: 'Fitness', location: 'Nugegoda', companySize: '5-10',
    source: 'INSTAGRAM', stage: 'AWAITING_REPLY', priority: 'MEDIUM',
    whyTargeted: 'Strong social media (45k followers) but no professional website — memberships only via DMs.',
    pitchAngle: 'Landing page with membership plans + class schedule and online sign-up.',
    problems: JSON.stringify(['No website', 'Manual processes']),
    instagram: '@fitzonegym.lk', email: 'dinesh@fitzonegym.lk',
    assignedToId: prasanna.id, lastActivityAt: daysAgo(16),
  }})
  const oceanblue = await db.lead.create({ data: {
    businessName: 'Ocean Blue Seafood', contactPerson: 'Tariq Hassan', jobTitle: 'Owner', website: '', industry: 'Restaurant', location: 'Mount Lavinia', companySize: '10-25',
    source: 'WALK_IN', stage: 'OPPORTUNITY_IDENTIFIED', priority: 'MEDIUM',
    whyTargeted: 'Busy beachfront restaurant with zero online presence — no site, no table booking.',
    pitchAngle: 'Simple site with menu, Google Maps optimisation and table reservation form.',
    problems: JSON.stringify(['No website', 'No booking system']),
    phone: '+94 77 889 2210',
    assignedToId: prasanna.id, lastActivityAt: daysAgo(6),
  }})
  const colombolaw = await db.lead.create({ data: {
    businessName: 'Colombo Law Associates', contactPerson: 'Shanika Rajapaksa', jobTitle: 'Senior Partner', website: 'https://colombolaw.lk', industry: 'Legal', location: 'Colombo 03', companySize: '10-25',
    source: 'GOOGLE_MAPS', stage: 'RESEARCHING', priority: 'LOW',
    whyTargeted: 'Established law firm, website loads in 9s and has no SSL — hurting credibility.',
    pitchAngle: 'Fast, secure, trust-focused website with practice area pages.',
    problems: JSON.stringify(['Slow website', 'Outdated website']),
    email: 'info@colombolaw.lk',
    assignedToId: ahmd.id, lastActivityAt: daysAgo(9),
  }})
  const greenleaf = await db.lead.create({ data: {
    businessName: 'GreenLeaf Organics', contactPerson: 'Ishara Wijesinghe', jobTitle: 'Co-founder', website: 'https://greenleaf.lk', industry: 'Food & Beverage', location: 'Colombo 08', companySize: '5-10',
    source: 'INSTAGRAM', stage: 'MEETING', priority: 'HIGH',
    whyTargeted: 'Growing D2C organic brand selling only via Instagram DMs — obvious e-commerce gap.',
    pitchAngle: 'E-commerce store with subscription boxes and Instagram shop integration.',
    problems: JSON.stringify(['No website', 'Manual processes']),
    email: 'ishara@greenleaf.lk', whatsapp: '+94 71 445 9087', instagram: '@greenleaf.organics',
    assignedToId: prasanna.id, lastActivityAt: daysAgo(1), nextFollowUpAt: daysFromNow(1),
  }})
  const urbancuts = await db.lead.create({ data: {
    businessName: 'Urban Cuts Salon', contactPerson: 'Kavindi Perera', jobTitle: 'Owner', website: '', industry: 'Beauty & Wellness', location: 'Dehiwala', companySize: '1-5',
    source: 'GOOGLE_MAPS', stage: 'LEAD_FOUND', priority: 'LOW',
    whyTargeted: 'Salon with 4.8★ Google rating but no website or online booking.',
    pitchAngle: 'Stylish one-pager with booking integration.',
    problems: JSON.stringify(['No website', 'No booking system']),
    instagram: '@urbancuts.dehiwala',
    assignedToId: prasanna.id, lastActivityAt: daysAgo(3),
  }})

  // ── Lead activity timelines ──
  const act = (data: any) => db.activity.create({ data })
  await act({ type: 'LEAD_DISCOVERED', title: 'Lead discovered', description: 'Found on Google Maps while researching furniture showrooms. Ranks high on Google but website is outdated.', date: daysAgo(38), userId: prasanna.id, leadId: bloom.id })
  await act({ type: 'WEBSITE_ANALYSED', title: 'Website analysed', description: 'Template from 2014. Product images broken on mobile. No lead capture form. PageSpeed 34/100 mobile.', date: daysAgo(37), userId: ahmd.id, leadId: bloom.id })
  await act({ type: 'PITCH_CREATED', title: 'Website concept created', description: 'Built a personalised homepage concept — dark luxury theme with WhatsApp quote CTA. Sent as private Figma link.', date: daysAgo(35), userId: ahmd.id, leadId: bloom.id })
  await act({ type: 'EMAIL_SENT', title: 'Cold email sent', description: 'Sent the concept link with 3 specific mobile-bug screenshots from their live site.', date: daysAgo(34), userId: prasanna.id, leadId: bloom.id })
  await act({ type: 'REPLY', title: 'Positive reply', description: 'Nadia: "Love the concept — didn\'t realise how bad mobile looked. Can you visit the showroom?"', date: daysAgo(31), userId: prasanna.id, leadId: bloom.id })
  await act({ type: 'MEETING', title: 'Showroom meeting', description: 'Met Nadia + her husband. Agreed scope: 12-page catalogue site, CMS, WhatsApp integration. Budget agreed $2,800.', date: daysAgo(28), userId: prasanna.id, leadId: bloom.id })
  await act({ type: 'STAGE_CHANGED', title: 'Deal won', description: 'Signed. 50% advance received. Kicked off Bloom & Co Website Redesign project.', date: daysAgo(18), userId: prasanna.id, leadId: bloom.id })

  await act({ type: 'LEAD_DISCOVERED', title: 'Lead discovered', description: 'Found via LinkedIn — premium dental spa, bio link broken.', date: daysAgo(12), userId: prasanna.id, leadId: serene.id })
  await act({ type: 'EMAIL_SENT', title: 'Cold email sent', description: 'Pointed out broken bio link + no online booking. Attached 1-page audit.', date: daysAgo(10), userId: prasanna.id, leadId: serene.id })
  await act({ type: 'REPLY', title: 'Reply received', description: 'Dr. Malik: "Interesting timing — we lost bookings last month. Send me medical work you\'ve done."', date: daysAgo(4), userId: prasanna.id, leadId: serene.id })
  await act({ type: 'FOLLOW_UP', title: 'Follow-up scheduled', description: 'Send Serene Dental Spa portfolio + case study of dental client.', date: daysAgo(4), userId: prasanna.id, leadId: serene.id })

  await act({ type: 'LEAD_DISCOVERED', title: 'Lead discovered', description: 'Referral from Priya (Ceylon Spice Co). Director Ruwan Perera.', date: daysAgo(21), userId: ahmd.id, leadId: lanka.id })
  await act({ type: 'MEETING', title: 'Discovery call', description: 'Their buyer portal is PDFs over email. Interested in a proper B2B portal. Asked for proposal.', date: daysAgo(14), userId: ahmd.id, leadId: lanka.id })
  await act({ type: 'PROPOSAL', title: 'Proposal sent', description: 'Sent B2B portal proposal — $8,500, 8-week timeline, phased rollout.', date: daysAgo(2), userId: ahmd.id, leadId: lanka.id })

  await act({ type: 'LEAD_DISCOVERED', title: 'Lead discovered', description: 'Found via Instagram hashtags. 45k followers, no website.', date: daysAgo(20), userId: prasanna.id, leadId: fitzone.id })
  await act({ type: 'WHATSAPP_SENT', title: 'WhatsApp sent', description: 'Sent membership-landing-page mockup. Dinesh replied "looks good, will discuss with owner".', date: daysAgo(16), userId: prasanna.id, leadId: fitzone.id })
  await act({ type: 'FOLLOW_UP', title: 'Follow-up scheduled', description: 'Chase Dinesh — no reply for 16 days. Try WhatsApp voice note this time.', date: daysAgo(16), userId: prasanna.id, leadId: fitzone.id })

  await act({ type: 'LEAD_DISCOVERED', title: 'Lead discovered', description: 'Walk-in during beach recon. Talked to owner Tariq — no site at all.', date: daysAgo(8), userId: prasanna.id, leadId: oceanblue.id })
  await act({ type: 'NOTE', title: 'Opportunity identified', description: 'Zero online presence. Tourists ask staff for the menu daily. Reservation form + maps optimisation is an easy sell.', date: daysAgo(6), userId: prasanna.id, leadId: oceanblue.id })

  await act({ type: 'LEAD_DISCOVERED', title: 'Lead discovered', description: 'Google Maps sweep of Colombo 03 professional services.', date: daysAgo(9), userId: ahmd.id, leadId: colombolaw.id })
  await act({ type: 'RESEARCH', title: 'Research completed', description: 'SSL missing, 9s load time, no practice-area pages. Decision makers: 3 senior partners.', date: daysAgo(9), userId: ahmd.id, leadId: colombolaw.id })

  await act({ type: 'LEAD_DISCOVERED', title: 'Lead discovered', description: 'Instagram — greenleaf.organics. DM-first sales, huge e-comm gap.', date: daysAgo(11), userId: prasanna.id, leadId: greenleaf.id })
  await act({ type: 'DEMO', title: 'E-comm demo (remote)', description: 'Showed Shopify-style subscription flow. Ishara loved it. Meeting scheduled at their Colombo 08 studio.', date: daysAgo(1), userId: prasanna.id, leadId: greenleaf.id })

  await act({ type: 'LEAD_DISCOVERED', title: 'Lead discovered', description: 'Google Maps — high rated salon, zero web presence.', date: daysAgo(3), userId: prasanna.id, leadId: urbancuts.id })

  // ── Outreach ──
  const out = (data: any) => db.outreach.create({ data })
  await out({ channel: 'COLD_EMAIL', date: daysAgo(34), leadId: bloom.id, message: 'Website concept + mobile bug screenshots', status: 'POSITIVE', response: 'Loved the concept, asked for a meeting.', userId: prasanna.id })
  await out({ channel: 'LINKEDIN', date: daysAgo(10), leadId: serene.id, message: 'Audit PDF + booking-gap pitch', status: 'REPLIED', response: 'Asked for medical portfolio.', followUpRequired: true, userId: prasanna.id })
  await out({ channel: 'REFERRAL', date: daysAgo(21), leadId: lanka.id, message: 'Intro via Priya (Ceylon Spice Co)', status: 'MEETING_BOOKED', userId: ahmd.id })
  await out({ channel: 'WHATSAPP', date: daysAgo(16), leadId: fitzone.id, message: 'Landing page mockup', status: 'REPLIED', response: '"Looks good, will discuss with owner."', userId: prasanna.id })
  await out({ channel: 'COLD_EMAIL', date: daysAgo(15), leadId: colombolaw.id, message: 'Speed + SSL audit', status: 'NO_RESPONSE', userId: ahmd.id })
  await out({ channel: 'INSTAGRAM', date: daysAgo(12), leadId: greenleaf.id, message: 'DM with subscription-store idea', status: 'REPLIED', response: 'Asked for a call.', userId: prasanna.id })
  await out({ channel: 'PHONE', date: daysAgo(11), leadId: greenleaf.id, message: 'Intro call → booked demo', status: 'MEETING_BOOKED', userId: prasanna.id })
  await out({ channel: 'VISIT', mode: 'OFFLINE', date: daysAgo(8), leadId: oceanblue.id, whoMet: 'Tariq Hassan (owner)', whatWasDiscussed: 'No website, tourists can\'t find menu', whatTheySaid: '"Everyone asks for the menu online"', interest: 'MAYBE', nextAction: 'Send simple quote for one-pager + booking form', userId: prasanna.id })
  await out({ channel: 'COLD_EMAIL', date: daysAgo(6), leadId: urbancuts.id, message: 'Booking one-pager pitch', status: 'SENT', userId: prasanna.id })
  await out({ channel: 'COLD_EMAIL', date: daysAgo(30), leadId: null, productId: null, saasLeadId: null, message: 'Generic agency intro (template test)', status: 'NO_RESPONSE', userId: ahmd.id })
  await out({ channel: 'REDDIT', date: daysAgo(5), message: 'Answered r/agency thread, DM follow-up', status: 'REPLIED', response: 'Asked about pricing for startup MVP.', userId: ahmd.id })

  // ── Pitches ──
  const pit = (data: any) => db.pitch.create({ data })
  await pit({ title: 'Bloom & Co — Luxury Catalogue Website', type: 'WEBSITE_CONCEPT', status: 'WON', link: 'https://figma.com/file/bloom-concept', notes: 'Dark luxury theme, WhatsApp quote CTA. Won the deal.', date: daysAgo(35), creatorId: ahmd.id, leadId: bloom.id })
  await pit({ title: 'Serene Dental Spa — Booking Website Proposal', type: 'PROPOSAL', status: 'SENT', link: 'https://docs.google.com/serene-proposal', notes: '$1,600 — 6 pages + online booking. Awaiting reply after portfolio follow-up.', date: daysAgo(5), creatorId: prasanna.id, leadId: serene.id })
  await pit({ title: 'Lanka Tea — B2B Buyer Portal Proposal', type: 'PROPOSAL', status: 'DISCUSSING', link: 'https://docs.google.com/lanka-portal', notes: '$8,500 phased. Ruwan reviewing budget with board.', date: daysAgo(2), creatorId: ahmd.id, leadId: lanka.id })
  await pit({ title: 'GreenLeaf — Subscription E-commerce Concept', type: 'PRESENTATION', status: 'READY', notes: 'Demo deck for the studio meeting tomorrow. Include harvest-to-door story.', date: daysAgo(1), creatorId: prasanna.id, leadId: greenleaf.id })
  await pit({ title: 'DentOS — Dental Clinic Landing Page', type: 'LANDING_PAGE', status: 'DRAFT', notes: 'For online outreach to dental clinics. Half done — hero copy needs work.', date: daysAgo(7), creatorId: ahmd.id })

  // ── Follow-ups ──
  const fu = (data: any) => db.followUp.create({ data })
  await fu({ title: 'Send Serene Dental Spa the medical portfolio', dueDate: daysAgo(2), method: 'EMAIL', reason: 'They asked for medical client examples', context: 'Dr. Malik replied positively but wants proof of healthcare work', suggestedNextAction: 'Send Serene proposal + dental case study, then call', status: 'UPCOMING', leadId: serene.id, createdById: prasanna.id })
  await fu({ title: 'Chase FitZone (16 days silent)', dueDate: daysAgo(1), method: 'WHATSAPP', reason: 'No reply since mockup sent', context: 'Dinesh said "will discuss with owner" — needs a nudge', suggestedNextAction: 'Send voice note + limited-time offer', status: 'UPCOMING', leadId: fitzone.id, createdById: prasanna.id })
  await fu({ title: 'GreenLeaf studio meeting prep', dueDate: daysFromNow(0, 18), method: 'MEETING', reason: 'Meeting tomorrow at their studio', context: 'Bring subscription concept + pricing one-pager', suggestedNextAction: 'Finalise GreenLeaf presentation deck', status: 'UPCOMING', leadId: greenleaf.id, createdById: prasanna.id })
  await fu({ title: 'Follow up on Lanka Tea proposal', dueDate: daysFromNow(2), method: 'PHONE', reason: 'Proposal sent, budget cycle ends this month', context: 'Ruwan reviewing with board — decision expected by month end', suggestedNextAction: 'Call Ruwan, offer to walk through proposal on a call', status: 'UPCOMING', leadId: lanka.id, createdById: ahmd.id })
  await fu({ title: 'Ocean Blue — send simple quote', dueDate: daysFromNow(3), method: 'WHATSAPP', reason: 'Owner asked for a quote after visit', context: 'One-pager + reservation form quote', suggestedNextAction: 'Send quote and 2 example designs', status: 'UPCOMING', leadId: oceanblue.id, createdById: prasanna.id })
  // completed
  await fu({ title: 'Send Bloom & Co contract', dueDate: daysAgo(19), method: 'EMAIL', reason: 'Deal agreed at showroom meeting', status: 'COMPLETED', completedAt: daysAgo(18), leadId: bloom.id, createdById: prasanna.id })
  await fu({ title: 'Book GreenLeaf demo call', dueDate: daysAgo(11), method: 'PHONE', reason: 'They replied to IG DM', status: 'COMPLETED', completedAt: daysAgo(11), leadId: greenleaf.id, createdById: prasanna.id })
  await fu({ title: 'Serene — first email nudge', dueDate: daysAgo(7), method: 'EMAIL', reason: 'No response to audit PDF', status: 'COMPLETED', completedAt: daysAgo(7), leadId: serene.id, createdById: prasanna.id })

  // ── Agency Clients ──
  const bloomClient = await db.client.create({ data: { name: 'Bloom & Co Furniture', industry: 'Furniture & Interior', website: 'https://bloomandco.lk', contactPerson: 'Nadia Fernando', email: 'nadia@bloomandco.lk', phone: '+94 77 231 4455', status: 'ACTIVE', notes: 'Co-owner (spouse) handles Instagram — loop her in on design decisions.', leadId: bloom.id } })
  await db.client.create({ data: { name: 'Ceylon Spice Co', industry: 'Food Export', website: 'https://ceylonspiceco.com', contactPerson: 'Priya Nagendra', email: 'priya@ceylonspice.com', status: 'ACTIVE', notes: 'Retainer client. Source of the Lanka Tea referral — keep them happy.' } })

  // ── Projects ──
  const projBloom = await db.project.create({ data: {
    name: 'Bloom & Co Website Redesign', client: { connect: { id: bloomClient.id } }, type: 'REDESIGN',
    description: '12-page luxury catalogue website with CMS, WhatsApp quote integration and mobile-first product galleries.',
    status: 'DEVELOPMENT', startDate: daysAgo(17), deadline: daysFromNow(12), budget: 2800,
    team: JSON.stringify([ahmd.id, prasanna.id]),
    links: JSON.stringify([{ label: 'Figma — Design', url: 'https://figma.com/file/bloom-design' }, { label: 'Staging', url: 'https://bloom-staging.connec8.dev' }, { label: 'GitHub', url: 'https://github.com/connec8/bloom-co' }]),
    decisions: 'Dark luxury theme approved. Collections page uses lookbook layout instead of grid. WhatsApp button on every product card.',
  }})
  await db.project.create({ data: { name: 'Serene Dental Spa Website', type: 'WEBSITE', description: '6-page elegant site with online booking, pending proposal confirmation.', status: 'PLANNING', deadline: daysFromNow(30), budget: 1600, team: JSON.stringify([prasanna.id]), links: JSON.stringify([{ label: 'Audit PDF', url: 'https://connec8.dev/serene-audit' }]) } })
  const projConnec8 = await db.project.create({ data: { name: 'Connec8 Website v2', type: 'INTERNAL', description: 'Refresh of our own agency site with new case studies and DentOS cross-sell section.', status: 'TESTING', startDate: daysAgo(40), deadline: daysFromNow(7), budget: 0, team: JSON.stringify([ahmd.id, prasanna.id]), links: JSON.stringify([{ label: 'Staging', url: 'https://v2.connec8.dev' }]), decisions: 'Keep pure black + emerald accent. Add interactive ROI calculator for DentOS.' } })

  // ── Tasks ──
  const task = (data: any) => db.projectTask.create({ data })
  await task({ title: 'Build product catalogue API', projectId: projBloom.id, assigneeId: ahmd.id, priority: 'HIGH', status: 'DONE', deadline: daysAgo(5), notes: 'Includes image variants + WhatsApp deep links.' })
  await task({ title: 'Homepage + lookbook sections', projectId: projBloom.id, assigneeId: ahmd.id, priority: 'HIGH', status: 'IN_PROGRESS', deadline: daysFromNow(3) })
  await task({ title: 'CMS setup for Nadia (blog + products)', projectId: projBloom.id, assigneeId: ahmd.id, priority: 'MEDIUM', status: 'TODO', deadline: daysFromNow(6) })
  await task({ title: 'Mobile performance pass (target 90+ PageSpeed)', projectId: projBloom.id, assigneeId: ahmd.id, priority: 'HIGH', status: 'BLOCKED', deadline: daysFromNow(4), notes: 'Hero video from Nadia is 80MB — waiting for compressed version.' })
  await task({ title: 'Write product copy (12 pages)', projectId: projBloom.id, assigneeId: prasanna.id, priority: 'MEDIUM', status: 'IN_PROGRESS', deadline: daysFromNow(5) })
  await task({ title: 'WhatsApp quote integration test', projectId: projBloom.id, assigneeId: ahmd.id, priority: 'MEDIUM', status: 'TODO', deadline: daysFromNow(8) })
  await task({ title: 'QA across devices', projectId: projBloom.id, assigneeId: prasanna.id, priority: 'LOW', status: 'TODO', deadline: daysFromNow(10) })
  await task({ title: 'Fix newsletter form on staging', projectId: projConnec8.id, assigneeId: ahmd.id, priority: 'MEDIUM', status: 'IN_PROGRESS', deadline: daysFromNow(2) })
  await task({ title: 'DentOS ROI calculator section', projectId: projConnec8.id, assigneeId: ahmd.id, priority: 'LOW', status: 'TODO', deadline: daysFromNow(6) })

  // ── Meetings ──
  const meet = (data: any) => db.meeting.create({ data })
  await meet({ title: 'Bloom & Co — Showroom meeting', dateTime: daysAgo(28), leadId: bloom.id, clientId: bloomClient.id, projectId: projBloom.id, purpose: 'Scope + budget alignment', participants: JSON.stringify(['Nadia Fernando', 'Ahmd', 'Prasanna']), notes: 'Showroom tour. Nadia cares most about brand feel; husband about cost.', decisions: '12-page catalogue, dark luxury theme, $2,800 fixed, 6-week timeline.', actionItems: JSON.stringify([{ text: 'Send contract', done: true }, { text: 'Prepare design kickoff', done: true }, { text: 'Collect product photos from Nadia', done: false }]) })
  await meet({ title: 'Lanka Tea — Discovery call', dateTime: daysAgo(14), leadId: lanka.id, purpose: 'Understand buyer portal workflow', participants: JSON.stringify(['Ruwan Perera', 'Ahmd']), notes: 'Weekly PDF price lists emailed to 40+ buyers. Manual order tracking in spreadsheets.', decisions: 'Proposal for phased B2B portal.', actionItems: JSON.stringify([{ text: 'Draft portal proposal', done: true }]) })
  await meet({ title: 'GreenLeaf — Studio meeting', dateTime: daysFromNow(1, 11), leadId: greenleaf.id, purpose: 'Present e-commerce concept', participants: JSON.stringify(['Ishara Wijesinghe', 'Prasanna']), notes: 'Bring printed pricing one-pager.' })
  await meet({ title: 'Lanka Tea — Proposal walkthrough', dateTime: daysFromNow(3, 15), leadId: lanka.id, purpose: 'Walk Ruwan through the portal proposal' })

  // ── Contacts ──
  const con = (data: any) => db.contact.create({ data })
  await con({ name: 'Nadia Fernando', company: 'Bloom & Co Furniture', role: 'Owner', email: 'nadia@bloomandco.lk', phone: '+94 77 231 4455', whatsapp: '+94 77 231 4455', socialOther: 'IG @bloomandco.lk', notes: 'Decision maker. Slow but loyal once committed.', leadId: bloom.id, clientId: bloomClient.id })
  await con({ name: 'Dr. Malik Jayawardena', company: 'Serene Dental Spa', role: 'Founder & Dentist', email: 'info@serenedental-spa.com', whatsapp: '+94 76 552 8891', linkedin: 'in/malik-jayawardena', notes: 'Responsive on LinkedIn, prefers email for documents.', leadId: serene.id })
  await con({ name: 'Ruwan Perera', company: 'Lanka Tea Exporters', role: 'Director', email: 'ruwan@lankateaexport.com', phone: '+94 81 220 3344', linkedin: 'in/ruwan-perera', notes: 'Referred by Priya. Board-facing, formal communication.', leadId: lanka.id })
  await con({ name: 'Priya Nagendra', company: 'Ceylon Spice Co', role: 'Managing Director', email: 'priya@ceylonspice.com', notes: 'Referral source. Introduce her to other clients as social proof.', clientId: bloomClient.id })
  await con({ name: 'Ishara Wijesinghe', company: 'GreenLeaf Organics', role: 'Co-founder', email: 'ishara@greenleaf.lk', whatsapp: '+94 71 445 9087', socialOther: 'IG @greenleaf.organics', notes: 'Fast mover, sustainability-focused messaging works.', leadId: greenleaf.id })
  await con({ name: 'Dinesh Silva', company: 'FitZone Gym', role: 'Manager', whatsapp: '+94 76 310 7788', notes: 'Gatekeeper — owner makes final calls.', leadId: fitzone.id })
  await con({ name: 'Dr. Saman Gunaratne', company: 'ABC Dental Clinic', role: 'Chief Dentist', phone: '+94 77 654 3210', notes: 'DentOS prospect. Very interested in appointment management.', saasLeadId: null })

  // ── SaaS Product: DentOS ──
  const dentos = await db.saasProduct.create({ data: {
    name: 'DentOS', tagline: 'Practice management for dental clinics',
    description: 'Dental clinic operating system: appointments, patient records, billing, reminders and analytics. Sold to clinics via offline visits + online outreach.',
    accent: '#0D9488',
  }})

  // ── DentOS Features ──
  const feat = (data: any) => db.saasFeature.create({ data: { productId: dentos.id, ...data } })
  await feat({ name: 'Appointment calendar', description: 'Drag-and-drop weekly calendar with chair/room allocation, booking colours per treatment type.', whyItMatters: 'Core of the product — every clinic demo starts here.', area: 'Appointments', priority: 'CRITICAL', status: 'COMPLETED', effort: 'XL', weight: 8, assigneeId: ahmd.id, completedAt: daysAgo(20), dateAdded: daysAgo(60) })
  await feat({ name: 'Patient records', description: 'Patient profiles with treatment history, x-ray attachments, allergies, notes.', whyItMatters: 'Clinics keep paper files today — the #1 pain we saw in visits.', area: 'Patients', priority: 'CRITICAL', status: 'COMPLETED', effort: 'L', weight: 6, assigneeId: ahmd.id, completedAt: daysAgo(12), dateAdded: daysAgo(58) })
  await feat({ name: 'WhatsApp appointment reminders', description: 'Automatic WhatsApp reminders 24h before appointment with confirm/reschedule buttons.', whyItMatters: 'No-shows are the top complaint from every clinic we visited.', area: 'Reminders', priority: 'HIGH', status: 'TESTING', effort: 'M', weight: 4, assigneeId: ahmd.id, notes: 'Template approval pending with Meta — testing with sandbox numbers.', dateAdded: daysAgo(40) })
  await feat({ name: 'Billing & invoices', description: 'Treatment-wise billing, invoice PDF export, payment tracking.', whyItMatters: 'Second-most requested feature during clinic visits.', area: 'Billing', priority: 'HIGH', status: 'IN_DEVELOPMENT', effort: 'L', weight: 6, assigneeId: ahmd.id, dateAdded: daysAgo(35) })
  await feat({ name: 'Voice booking assistant', description: 'Receptionist can dictate appointments; assistant parses and books them.', whyItMatters: 'Demo showstopper — wow factor that closes clinics.', area: 'Appointments', priority: 'MEDIUM', status: 'BLOCKED', effort: 'L', weight: 5, assigneeId: ahmd.id,
    whyNotCompleted: 'TECHNICAL_DIFFICULTY', blockingDetail: 'Whisper transcription works, but parsing Sinhala/English mixed speech ("book Mr Perera tomorrow 4:30 cleaning") misfires ~30%. Need better intent parsing.', nextStep: 'Prototype a structured-output prompt with function calling instead of raw parsing.', notes: 'Related knowledge: "DentOS Voice Feature — debugging notes".', dateAdded: daysAgo(30) })
  await feat({ name: 'Multi-branch support', description: 'Clinic chains: separate chairs/staff per branch, consolidated owner dashboard.', whyItMatters: 'Two prospect chains asked — upsell path to Pro plan.', area: 'Platform', priority: 'MEDIUM', status: 'PLANNED', effort: 'XL', weight: 8, dateAdded: daysAgo(22) })
  await feat({ name: 'Insurance claim tracking', description: 'Track insurance claims per patient, status timeline, pending payouts.', whyItMatters: 'Asked by 3 clinics; big admin time sink.', area: 'Billing', priority: 'MEDIUM', status: 'RESEARCHING', effort: 'L', weight: 5, whyNotCompleted: 'NEEDS_RESEARCH', blockingDetail: 'Need to map local insurance providers\' claim formats first.', dateAdded: daysAgo(18) })
  await feat({ name: 'Treatment plan templates', description: 'Pre-built plans (root canal, braces) with staged pricing clinics can customise.', whyItMatters: 'Speeds up chair-side quoting.', area: 'Patients', priority: 'MEDIUM', status: 'READY_TO_BUILD', effort: 'M', weight: 3, dateAdded: daysAgo(15) })
  await feat({ name: 'Staff roles & permissions', description: 'Dentist / receptionist / owner roles with different access.', whyItMatters: 'Owners worry receptionists seeing finance data.', area: 'Platform', priority: 'HIGH', status: 'IN_DEVELOPMENT', effort: 'M', weight: 4, assigneeId: ahmd.id, whyNotCompleted: 'LOWER_PRIORITY', blockingDetail: 'Paused while billing ships — ABC Dental asked for billing first.', nextStep: 'Resume after billing MVP.', dateAdded: daysAgo(25) })
  await feat({ name: 'Patient self-booking page', description: 'Clinic-branded link patients use to book open slots.', whyItMatters: 'Serene Dental Spa showed demand — broken booking links lose patients.', area: 'Appointments', priority: 'HIGH', status: 'PLANNED', effort: 'M', weight: 4, dependencies: 'Appointment calendar', dateAdded: daysAgo(10) })
  await feat({ name: 'Daily revenue dashboard', description: 'Owner view: revenue per day/week, top treatments, chair utilisation.', whyItMatters: 'Owners love numbers — retention feature.', area: 'Analytics', priority: 'MEDIUM', status: 'IDEA', effort: 'M', weight: 3, dateAdded: daysAgo(8) })
  await feat({ name: 'Automated recall reminders', description: '6-month check-up recall messages per patient.', whyItMatters: 'Passive revenue driver for clinics.', area: 'Reminders', priority: 'LOW', status: 'IDEA', effort: 'S', weight: 2, dateAdded: daysAgo(5) })

  // ── DentOS SaaS Leads ──
  const slead = (data: any) => db.saasLead.create({ data })
  const abc = await slead({ businessName: 'ABC Dental Clinic', location: 'Colombo 04', contactPerson: 'Dr. Saman Gunaratne', role: 'Chief Dentist', phone: '+94 77 654 3210', email: 'abc.dental@gmail.com',
    origin: 'OFFLINE', funnelStage: 'INTERESTED', interested: 'YES',
    problems: JSON.stringify(['Appointment book is paper', 'No-shows ~15%', 'Patient files in cardboard boxes']),
    requirements: 'Appointment management + patient records first. 3 chairs, 2 dentists, 1 receptionist.',
    featuresRequested: 'Wants WhatsApp reminders in the demo',
    objections: 'Worried receptionist will find it complicated',
    importantStatements: '"If it replaces my appointment book and reminds patients, I\'ll pay for it."',
    notes: 'Visited Sept 1. Receptionist Maheesha is the daily user — train her during onboarding.',
    productId: dentos.id, lastActivityAt: daysAgo(2), nextFollowUpAt: daysFromNow(0, 15) })
  const xyz = await slead({ businessName: 'XYZ Dental Care', location: 'Nugegoda', contactPerson: 'Maheesha Rodrigo', role: 'Receptionist', phone: '+94 76 882 1120',
    origin: 'ONLINE', funnelStage: 'REPLIED', interested: 'MAYBE',
    requirements: 'Asked for pricing via WhatsApp. 2-chair clinic.',
    questions: 'Is there a monthly plan? Do we need a computer or does it work on tablets?',
    notes: 'Receptionist friendly, owner not met yet.',
    productId: dentos.id, lastActivityAt: daysAgo(4), nextFollowUpAt: daysAgo(3) })
  const smilecare = await slead({ businessName: 'SmileCare Dental', location: 'Dehiwala', contactPerson: 'Dr. Anusha Peiris', role: 'Owner', phone: '+94 71 220 4567',
    origin: 'OFFLINE', funnelStage: 'TRIAL', interested: 'YES',
    problems: JSON.stringify(['Double bookings', 'No patient history']),
    feedback: 'Calendar feels great. Wants billing before committing.',
    productId: dentos.id, lastActivityAt: daysAgo(1) })
  const pearl = await slead({ businessName: 'Pearl Dental Studio', location: 'Colombo 06', contactPerson: 'Dr. Ravi Nathavan', role: 'Owner', phone: '+94 77 908 5522', email: 'ravi@pearldental.lk', website: 'https://pearldental.lk',
    origin: 'ONLINE', funnelStage: 'DEMO', interested: 'YES',
    requirements: 'Multi-branch later (2 branches planned). Insurance claim tracking important.',
    importantStatements: '"Show me the analytics my competitor clinics don\'t have."',
    productId: dentos.id, lastActivityAt: daysAgo(3) })
  const brightsmile = await slead({ businessName: 'BrightSmile Dental', location: 'Rajagiriya', contactPerson: 'Nethmi Silva', role: 'Receptionist', email: 'brightsmile.dental@gmail.com',
    origin: 'ONLINE', funnelStage: 'CONTACTED',
    notes: 'Cold email sent with landing page. No reply yet.',
    productId: dentos.id, lastActivityAt: daysAgo(6), nextFollowUpAt: daysFromNow(1) })
  const lakeview = await slead({ businessName: 'Lakeview Dental Surgery', location: 'Battaramulla', contactPerson: 'Dr. Kumari Herath', role: 'Owner',
    origin: 'OFFLINE', funnelStage: 'LEAD',
    notes: 'Drove past — new clinic, just opened. Visit next week.',
    productId: dentos.id, lastActivityAt: daysAgo(2) })

  // ── DentOS outreach (online + offline visits) ──
  const sout = (data: any) => db.outreach.create({ data })
  await sout({ channel: 'VISIT', mode: 'OFFLINE', date: daysAgo(2), saasLeadId: abc.id, productId: dentos.id,
    whoMet: 'Dr. Saman Gunaratne', whatWasDiscussed: 'DentOS demo on tablet — appointment calendar + patient records',
    whatTheySaid: '"If it replaces my appointment book and reminds patients, I\'ll pay for it."',
    problemsIdentified: 'Paper appointment book, ~15% no-shows, paper patient files',
    objections: 'Receptionist might find it complicated',
    featuresLiked: 'Drag-and-drop calendar, colour-coded bookings',
    featuresRequested: 'WhatsApp reminders before appointment',
    interest: 'YES', nextAction: 'Call to confirm demo slot with full reminder flow', followUpRequired: true, userId: ahmd.id })
  await sout({ channel: 'WHATSAPP', mode: 'ONLINE', date: daysAgo(4), saasLeadId: xyz.id, productId: dentos.id, message: 'Intro + screenshots', status: 'REPLIED', response: 'Asked for pricing', followUpRequired: true, userId: ahmd.id })
  await sout({ channel: 'VISIT', mode: 'OFFLINE', date: daysAgo(9), saasLeadId: smilecare.id, productId: dentos.id,
    whoMet: 'Dr. Anusha Peiris', whatWasDiscussed: 'Walked through trial onboarding', whatTheySaid: '"Calendar feels great, where is billing?"',
    objections: 'Wants billing before paying', featuresLiked: 'Calendar, patient records', interest: 'YES', nextAction: 'Demo billing module when ready', followUpRequired: true, userId: ahmd.id })
  await sout({ channel: 'COLD_EMAIL', mode: 'ONLINE', date: daysAgo(6), saasLeadId: brightsmile.id, productId: dentos.id, message: 'DentOS landing page + booking offer', status: 'SENT', followUpRequired: true, userId: ahmd.id })
  await sout({ channel: 'LINKEDIN', mode: 'ONLINE', date: daysAgo(5), saasLeadId: pearl.id, productId: dentos.id, message: 'DentOS analytics pitch', status: 'REPLIED', response: 'Asked for demo — booked', userId: ahmd.id })
  await sout({ channel: 'COLD_EMAIL', mode: 'ONLINE', date: daysAgo(14), productId: dentos.id, message: 'Blast #1 — 12 clinics from list', status: 'NO_RESPONSE', userId: ahmd.id })

  // ── DentOS follow-ups ──
  await fu({ title: 'Call ABC Dental Clinic — confirm demo slot', dueDate: daysFromNow(0, 15), method: 'PHONE', reason: 'Doctor expressed strong interest during visit', context: 'Wants WhatsApp reminders shown in demo', suggestedNextAction: 'Call at 3pm, book demo for Friday', status: 'UPCOMING', saasLeadId: abc.id, productId: dentos.id, createdById: ahmd.id })
  await fu({ title: 'Send XYZ Dental pricing breakdown', dueDate: daysAgo(3), method: 'WHATSAPP', reason: 'Requested pricing after WhatsApp chat', context: 'Receptionist asked about monthly plan + tablets', suggestedNextAction: 'Send DentOS pricing + tablet answer', status: 'UPCOMING', saasLeadId: xyz.id, productId: dentos.id, createdById: ahmd.id })
  await fu({ title: 'Visit Lakeview Dental Surgery', dueDate: daysFromNow(4), method: 'VISIT', reason: 'New clinic — no systems yet', context: 'Just opened in Battaramulla, perfect timing for DentOS', suggestedNextAction: 'Walk in, ask for Dr. Kumari, demo on tablet', status: 'UPCOMING', saasLeadId: lakeview.id, productId: dentos.id, createdById: ahmd.id })
  await fu({ title: 'Demo billing module to SmileCare', dueDate: daysFromNow(6), method: 'DEMO', reason: 'Trial convert blocked on billing', context: 'Dr. Anusha: "where is billing?"', suggestedNextAction: 'Schedule demo once billing MVP is testable', status: 'UPCOMING', saasLeadId: smilecare.id, productId: dentos.id, createdById: ahmd.id })
  await fu({ title: 'BrightSmile follow-up email', dueDate: daysFromNow(1), method: 'EMAIL', reason: 'No reply to cold email', status: 'UPCOMING', saasLeadId: brightsmile.id, productId: dentos.id, createdById: ahmd.id })

  // ── DentOS clients ──
  await db.saasClient.create({ data: {
    businessName: 'SmileCare Dental', contactPerson: 'Dr. Anusha Peiris', email: 'anusha@smilecare.lk', phone: '+94 71 220 4567',
    plan: 'TRIAL', status: 'TRIAL', onboardingStatus: 'IN_PROGRESS',
    featuresEnabled: JSON.stringify(['Appointment calendar', 'Patient records']),
    customRequirements: 'Needs billing before converting to paid.',
    feedback: 'Loves the calendar UX.', issues: 'Imported patients have duplicate names from CSV.',
    saasLeadId: smilecare.id, productId: dentos.id, onboardedAt: daysAgo(7),
  }})
  await db.saasClient.create({ data: {
    businessName: 'City Dental Center', contactPerson: 'Dr. Nadeeka Silva', email: 'admin@citydental.lk', phone: '+94 11 234 5566',
    plan: 'PRO', status: 'ACTIVE', onboardingStatus: 'COMPLETED',
    featuresEnabled: JSON.stringify(['Appointment calendar', 'Patient records', 'WhatsApp reminders']),
    featureRequests: 'Wants daily revenue dashboard and multi-branch support.',
    feedback: 'No-shows dropped from 12% to 4% in month one.',
    productId: dentos.id, onboardedAt: daysAgo(25),
  }})

  // ── DentOS activity ──
  await act({ type: 'VISIT_LOGGED', title: 'ABC Dental Clinic visited', description: 'Met Dr. Saman. Demoed calendar + records on tablet. Strong interest — objections around receptionist training.', date: daysAgo(2), userId: ahmd.id, saasLeadId: abc.id, productId: dentos.id })
  await act({ type: 'VISIT_LOGGED', title: 'SmileCare Dental visited', description: 'Trial onboarding walk-through. Billing is the conversion blocker.', date: daysAgo(9), userId: ahmd.id, saasLeadId: smilecare.id, productId: dentos.id })
  await act({ type: 'FEATURE_UPDATE', title: 'Feature completed: Patient records', description: 'Patient records shipped to trial clinics.', date: daysAgo(12), userId: ahmd.id, productId: dentos.id })
  await act({ type: 'DEMO', title: 'Pearl Dental demo scheduled', description: 'LinkedIn reply converted to demo request. Dr. Ravi wants analytics differentiation.', date: daysAgo(3), userId: ahmd.id, saasLeadId: pearl.id, productId: dentos.id })

  // ── Knowledge ──
  const know = (data: any) => db.knowledgeItem.create({ data })
  await know({ title: 'DentOS Voice Feature — debugging notes', category: 'TECHNICAL', tags: JSON.stringify(['dentos', 'voice', 'whisper', 'parsing']), content: 'What it should do:\nReceptionist dictates appointments → auto-booked.\n\nTechnical problems hit so far:\n1. Whisper handles Sinhala-English mixed speech OK-ish, but raw text parsing misfires ~30% ("book Mr Perera tomorrow 4:30 cleaning" → parsed date wrong when "tomorrow" spoken after 6pm).\n2. Function-calling approach (structured output) fixed most parsing errors in quick test.\n\nUseful resources:\n- OpenAI structured outputs docs\n- Local cache of test transcripts in Drive folder "dentos-voice-tests"\n\nNext: prototype function-calling version before touching the parser again.', link: 'https://github.com/connec8/dentos-voice-spike', authorId: ahmd.id, productId: dentos.id, pinned: true })
  await know({ title: 'Competitor scan — dental software (Sri Lanka)', category: 'COMPETITOR', tags: JSON.stringify(['dentos', 'competition', 'pricing']), content: '1. ClinicPro (India) — $8/seat/mo, no WhatsApp, no local support. Weak onboarding.\n2. DentalPlus (local) — desktop only, ugly, but has insurance claims.\n3. Custom Excel — what most clinics actually "use".\n\nOur wedge: WhatsApp-native reminders + dead-simple UX + local support. Nobody here does WhatsApp properly. Price anchor: Rs 7,500/mo Pro.', authorId: prasanna.id, productId: dentos.id })
  await know({ title: 'Sales insight — follow-up timing wins deals', category: 'SALES', tags: JSON.stringify(['sales', 'outreach', 'learnings']), content: 'Pattern from last 2 months:\n- Bloom & Co: won after 4 touches in 3 weeks.\n- Serene: replied on email #1 that referenced a SPECIFIC problem (broken bio link).\n- Generic "we build websites" emails: 0/9 replies.\n\nRule: every outreach must name one specific observable problem. Follow up within 48h of any reply. Voice notes on WhatsApp get ~2x response vs text.', authorId: prasanna.id, pinned: true })
  await know({ title: 'Website audit checklist (pre-outreach)', category: 'RESEARCH', tags: JSON.stringify(['process', 'audit', 'outreach']), content: 'Run before any pitch so every email names specifics:\n1. PageSpeed mobile score (screenshot)\n2. SSL + expiry (whoisxml)\n3. Mobile menu / tap targets\n4. Booking / lead capture present?\n5. Last copyright year in footer (site age hint)\n6. Google Business photos vs site quality\n\nTemplate audit PDF in Drive: /templates/audit-onepager.pdf', authorId: ahmd.id })
  await know({ title: 'Idea — DentOS referral loop', category: 'IDEA', tags: JSON.stringify(['dentos', 'growth']), content: 'Clinics refer other clinics: 1 month free per converted referral. Dental community in Colombo is tight — Dr. Saman knows everyone. Ask at ABC Dental demo.', authorId: ahmd.id, productId: dentos.id })
  await know({ title: 'Resource — local business lead sources', category: 'RESOURCE', tags: JSON.stringify(['leads', 'prospecting']), content: 'Working sources ranked:\n1. Google Maps category sweeps (furniture, salons, dental) — richest\n2. Instagram bio link check — broken/no link = warm\n3. New business registrations (gazette) — early, no site yet\n4. LinkedIn for professional services\n5. Reddit r/srilanka business threads — occasional\n\nLog every source in the Lead record so we can measure later.', authorId: prasanna.id })
  await know({ title: 'Decision — DentOS pricing (v1)', category: 'DECISION', tags: JSON.stringify(['dentos', 'pricing', 'decision']), content: 'Decided 12 Aug after visits:\n- Starter: Rs 4,500/mo — calendar + records, 1 chair\n- Pro: Rs 7,500/mo — + reminders + billing, 3 chairs\n- Trial: 14 days, we onboard personally (white-glove onboarding is our moat vs ClinicPro)\n\nReview after 5 paying clinics.', authorId: ahmd.id, productId: dentos.id })

  console.log('✓ Seed complete')
  console.log(`  Users: 2 | Leads: 8 | Activities: 26+ | Outreach: 12 | Pitches: 5 | Follow-ups: 13`)
  console.log(`  Projects: 3 | Tasks: 9 | Meetings: 4 | Contacts: 7 | Knowledge: 7`)
  console.log(`  DentOS: 12 features, 6 SaaS leads, 2 SaaS clients, visits + follow-ups`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
