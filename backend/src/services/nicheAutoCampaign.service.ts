import { prisma } from '../config/database.js'
import { logger } from '../utils/logger.js'

// Mapeamento de nichos para grupos de campanha
const NICHE_GROUPS: Record<string, string[]> = {
  'Beleza & Estética': [
    'Salão de Beleza', 'Barbearia', 'Manicure', 'Maquiagem', 'Estética', 'Beleza',
  ],
  'Saúde & Bem-estar': [
    'Academia', 'Pilates', 'Yoga', 'Personal Trainer', 'Fisioterapia',
    'Nutrição', 'Psicologia', 'Clínica de Psicologia', 'Fitness', 'Saúde',
  ],
  'Alimentação': [
    'Restaurante', 'Lanchonete', 'Confeitaria', 'Buffet', 'Buffet Infantil',
    'Alimentação', 'Adega',
  ],
  'Serviços': [
    'Eletricista', 'Desentupimento', 'Borracharia', 'Mecânica', 'Reformas',
    'Chaveiro', 'Climatização', 'Pintura', 'Serviços Domésticos', 'Transporte',
    'Segurança', 'Automotivo',
  ],
  'Saúde Profissional': ['Odontologia', 'Advocacia', 'Contabilidade', 'TI'],
  'Moda & Varejo': ['Moda', 'Moda Infantil', 'Gráfica', 'Design', 'Fotografia', 'Eventos'],
  'Educação & Outros': ['Educação', 'Auto Escola', 'Pet Shop', 'Dança', 'Pet'],
}

// Mensagens consultivas por grupo — usam {{nome}}, {{negocio}}, {{bairro}}, {{nicho}}
// Tom: próximo, humano, consultivo. Foco em dor específica do segmento + urgência da promoção.
const NICHE_MESSAGES: Record<string, string> = {
  'Beleza & Estética':
    'Olá, {{nome}}! Tudo bem?\n\nVi que o {{negocio}} está em {{bairro}} e queria entender como está a captação de clientes novos por lá — Instagram, Google, indicação?\n\nEstou ajudando salões e barbearias da Zona Leste a lotar a agenda com redes sociais que realmente convertem. Tem 10 minutos pra gente conversar?',

  'Saúde & Bem-estar':
    'Olá, {{nome}}! Tudo bem?\n\nSou da i9 Soluções e trabalho com academias, estúdios e clínicas aqui na Zona Leste. A maioria sofre com o mesmo problema: agenda cheia em janeiro e pela metade em julho.\n\nTenho uma estratégia específica pra isso. Posso te contar em 10 minutos como funciona pro {{negocio}}?',

  'Alimentação':
    'Olá, {{nome}}! Tudo bem?\n\nVi o {{negocio}} em {{bairro}} e queria entender como está o movimento — delivery, reservas, clientes presenciais?\n\nEstou ajudando restaurantes e lanchonetes da região a aumentar o fluxo com campanhas hiperlocais. Teria 10 minutos pra conversar?',

  'Serviços':
    'Olá, {{nome}}! Tudo bem?\n\nQuando alguém busca "{{nicho}} em {{bairro}}" no Google agora, o {{negocio}} aparece?\n\nEstou ajudando prestadores de serviço da Zona Leste a aparecer no topo do Google Maps. Posso te mostrar como está seu posicionamento hoje em 10 minutos?',

  'Saúde Profissional':
    'Olá, {{nome}}! Tudo bem?\n\nVi que o {{negocio}} atua com {{nicho}} em {{bairro}}. A maioria dos profissionais da área depende de indicação — o que deixa a carteira de clientes irregular.\n\nEstou ajudando consultórios e escritórios da Zona Leste a construir autoridade digital e captar clientes de forma previsível. Teria 10 minutos?',

  'Moda & Varejo':
    'Olá, {{nome}}! Tudo bem?\n\nVi o {{negocio}} em {{bairro}} e queria entender como está a presença de vocês no digital — Instagram, Google, anúncios?\n\nEstou ajudando negócios de moda e varejo da região a aumentar o alcance sem precisar de um time de marketing. Posso te mostrar como em 10 minutos?',

  'Educação & Outros':
    'Olá, {{nome}}! Tudo bem?\n\nVi que o {{negocio}} trabalha com {{nicho}} em {{bairro}}. Como está a captação de alunos/clientes novos — depende muito de indicação?\n\nEstou ajudando negócios de educação e serviços especializados da Zona Leste a manter o fluxo constante o ano todo. Teria 10 minutos pra conversar?',
}

const DEFAULT_MESSAGE =
  'Olá, {{nome}}! Tudo bem?\n\nVi o {{negocio}} em {{bairro}} e queria entender como está a presença digital de vocês.\n\nEstou ajudando negócios da Zona Leste a atrair mais clientes com marketing digital. Teria 10 minutos pra conversar?'

// Retorna o grupo de nicho para um nicho dado, ou null se não mapeado
export function getGroupForNiche(niche: string): string | null {
  const normalized = niche.trim().toLowerCase()
  for (const [group, niches] of Object.entries(NICHE_GROUPS)) {
    if (niches.some((n) => n.toLowerCase() === normalized)) return group
  }
  return null
}

function campaignName(group: string): string {
  const now = new Date()
  const month = now.toLocaleDateString('pt-BR', { month: 'long' })
  const monthCap = month.charAt(0).toUpperCase() + month.slice(1)
  const year = now.getFullYear()
  return `Prospecção ${group} - ${monthCap}/${year}`
}

async function getAdminUserId(): Promise<string | null> {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } })
  return admin?.id ?? null
}

async function getOrCreateNicheCampaign(group: string, adminId: string): Promise<string> {
  const name = campaignName(group)
  const existing = await prisma.campaign.findFirst({ where: { name }, select: { id: true } })
  if (existing) return existing.id

  const campaign = await prisma.campaign.create({
    data: {
      name,
      description: `Campanha automática gerada para leads do grupo "${group}". Revise antes de disparar.`,
      type: 'WHATSAPP',
      bodyText: NICHE_MESSAGES[group] ?? DEFAULT_MESSAGE,
      createdById: adminId,
    },
  })
  logger.info({ group, campaignId: campaign.id }, 'Campanha de nicho criada automaticamente')
  return campaign.id
}

// Trigger: chamado ao criar um novo lead (scraper ou sheets)
export async function autoAddLeadToNicheCampaign(leadId: string, niche: string): Promise<void> {
  try {
    const group = getGroupForNiche(niche)
    if (!group) return

    const adminId = await getAdminUserId()
    if (!adminId) return

    const campaignId = await getOrCreateNicheCampaign(group, adminId)

    await prisma.campaignLead.upsert({
      where: { campaignId_leadId: { campaignId, leadId } },
      create: { campaignId, leadId },
      update: {},
    })
  } catch (err) {
    logger.warn({ err, leadId, niche }, 'autoAddLeadToNicheCampaign falhou — lead salvo, campanha ignorada')
  }
}

export interface NicheGroupResult {
  group: string
  campaignId: string
  campaignName: string
  leadsAdded: number
}

// Endpoint: cria campanhas para todos os grupos com leads existentes
export async function autoCreateCampaignsByNiche(adminId: string): Promise<NicheGroupResult[]> {
  const leads = await prisma.lead.findMany({
    where: { niche: { not: '' } },
    select: { id: true, niche: true },
  })

  // Agrupa leads por grupo de nicho
  const grouped = new Map<string, string[]>()
  for (const lead of leads) {
    const group = getGroupForNiche(lead.niche)
    if (!group) continue
    const bucket = grouped.get(group) ?? []
    bucket.push(lead.id)
    grouped.set(group, bucket)
  }

  const results: NicheGroupResult[] = []

  for (const [group, leadIds] of grouped) {
    const campaignId = await getOrCreateNicheCampaign(group, adminId)
    const name = campaignName(group)

    await prisma.campaignLead.createMany({
      data: leadIds.map((leadId) => ({ campaignId, leadId })),
      skipDuplicates: true,
    })

    results.push({ group, campaignId, campaignName: name, leadsAdded: leadIds.length })
    logger.info({ group, campaignId, leadsAdded: leadIds.length }, 'Leads vinculados à campanha de nicho')
  }

  return results
}
