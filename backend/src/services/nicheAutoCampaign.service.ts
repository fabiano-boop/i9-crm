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
const NICHE_MESSAGES: Record<string, string> = {
  'Beleza & Estética':
    'Olá, {{nome}}! 👋\n\nVi que o {{negocio}} atua com {{nicho}} em {{bairro}} e identifiquei algumas oportunidades para lotar sua agenda com clientes novos.\n\nMuitos salões e clínicas estéticas perdem até 40% dos clientes por falta de presença digital consistente — Google Meu Negócio mal otimizado, sem estratégia de retenção e dependendo só do boca a boca.\n\nA i9 Soluções trabalha exatamente com isso: tráfego pago segmentado para o bairro e estratégias de fidelização que fazem o cliente voltar.\n\nTeria 10 minutos para uma conversa rápida? 🗓️',

  'Saúde & Bem-estar':
    'Olá, {{nome}}! 👋\n\nTrabalho com marketing digital para academias, estúdios e clínicas em {{bairro}} e percebi que muitos negócios de {{nicho}} sofrem com o mesmo problema: agenda cheia em janeiro e vazia em junho.\n\nA i9 Soluções tem uma estratégia específica para manter o fluxo de alunos/pacientes constante o ano todo, sem depender de sazonalidade.\n\nPosteria me contar como está a situação do {{negocio}} atualmente? Tenho um case do seu segmento que pode te interessar. 💪',

  'Alimentação':
    'Olá, {{nome}}! 👋\n\nSei que restaurantes e lanchonetes como o {{negocio}} sofrem com movimento fraco nos dias de semana e a concorrência crescente dos apps de delivery.\n\nA i9 Soluções tem ajudado negócios de alimentação em {{bairro}} a aumentar o fluxo presencial com campanhas hiperlocais — anúncios mostrados só para quem está próximo e buscando onde comer agora.\n\nGostaria de ver como isso funcionou para um restaurante similar ao seu? 🍽️',

  'Serviços':
    'Olá, {{nome}}! 👋\n\nVi que o {{negocio}} oferece serviços de {{nicho}} em {{bairro}}. Tenho uma pergunta direta: quando alguém busca "{{nicho}} em {{bairro}}" no Google, você aparece?\n\nA i9 Soluções especializa em colocar prestadores de serviço no topo do Google Maps — clientes que te encontram lá têm 3x mais chance de fechar do que por indicação.\n\nPosso te mostrar em 10 minutos como está seu posicionamento hoje? 🔧',

  'Saúde Profissional':
    'Olá, {{nome}}! 👋\n\nProfissionais de {{nicho}} em {{bairro}} costumam depender muito de indicações, o que gera uma carteira de clientes irregular e imprevisível.\n\nA i9 Soluções trabalha com estratégias digitais para consultórios e escritórios atraírem clientes qualificados de forma consistente — sem precisar esperar alguém te indicar.\n\nTeria interesse em ver um case de um profissional do seu segmento? 📊',

  'Moda & Varejo':
    'Olá, {{nome}}! 👋\n\nNegócios de {{nicho}} como o {{negocio}} têm um potencial enorme com a presença digital certa — Instagram bem posicionado, Google Meu Negócio otimizado e campanhas que atraem o cliente certo em {{bairro}}.\n\nA i9 Soluções está ajudando marcas da região a aumentar o alcance sem precisar de um time de marketing completo — e com resultado medido em vendas reais.\n\nPosso te mostrar como em uma conversa rápida? 🛍️',

  'Educação & Outros':
    'Olá, {{nome}}! 👋\n\nVi que o {{negocio}} atua com {{nicho}} em {{bairro}}. Negócios de educação e serviços especializados têm um desafio específico: atrair alunos e clientes novos fora dos períodos de pico.\n\nA i9 Soluções tem estratégias que mantêm o fluxo constante o ano todo — combinando presença no Google com campanhas segmentadas para o bairro.\n\nTeria 10 minutos para conversar sobre como está a captação no {{negocio}} hoje? 📚',
}

const DEFAULT_MESSAGE =
  'Olá, {{nome}}! 👋\n\nVi que o {{negocio}} atua em {{bairro}} e gostaria de apresentar como a i9 Soluções tem ajudado negócios da região a atrair mais clientes com marketing digital.\n\nTeria 10 minutos para uma conversa rápida? 🚀'

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
