import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const lead = await db.lead.findFirst({ where: { stage: 'ACTIVE_CONVERSATION' }, include: { activities: true, followUps: true } })
console.log('OK:', lead?.businessName, '| activities:', lead?.activities.length)
await db.$disconnect()
