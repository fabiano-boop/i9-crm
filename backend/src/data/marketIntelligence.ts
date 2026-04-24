// Inteligência de mercado — Zona Leste SP
// Usado para enriquecer leads automaticamente na importação do Sheets

export const segmentos = {
  salao_beleza: {
    nome: 'Salão de Beleza',
    prioridade: 'alta',
    dor: 'Confirmação de agendamentos manual, no-show de 20-30% das vagas',
    ticketMin: 297,
    ticketMax: 497,
    servicoIdeal: 'Agente WhatsApp + Lembretes automáticos',
    pacoteRecomendado: 'Growth',
    potencialConversao: 85,
  },
  restaurante: {
    nome: 'Restaurante / Delivery',
    prioridade: 'alta',
    dor: 'Pedidos no WhatsApp de forma caótica, dependência de funcionário para atender',
    ticketMin: 397,
    ticketMax: 697,
    servicoIdeal: 'Agente WhatsApp + Cardápio digital + Delivery próprio',
    pacoteRecomendado: 'Premium',
    potencialConversao: 80,
  },
  clinica: {
    nome: 'Clínica Odonto/Médica',
    prioridade: 'media',
    dor: 'Recepcionista sobrecarregada, cancelamentos de última hora',
    ticketMin: 497,
    ticketMax: 897,
    servicoIdeal: 'Agente WhatsApp + Triagem automática + Confirmação de consultas',
    pacoteRecomendado: 'Premium',
    potencialConversao: 55,
  },
  oficina: {
    nome: 'Oficina Mecânica',
    prioridade: 'media',
    dor: 'Cliente pergunta preço no WhatsApp, mecânico para trabalho para responder',
    ticketMin: 297,
    ticketMax: 497,
    servicoIdeal: 'Agente WhatsApp + Orçamentos automáticos + Status do carro',
    pacoteRecomendado: 'Start',
    potencialConversao: 50,
  },
  academia: {
    nome: 'Academia / Escola',
    prioridade: 'media',
    dor: 'Matrículas por mensagem, dúvidas sobre horários, renovação de plano manual',
    ticketMin: 297,
    ticketMax: 497,
    servicoIdeal: 'Agente WhatsApp + Matrícula online + Lembretes de renovação',
    pacoteRecomendado: 'Growth',
    potencialConversao: 45,
  },
  petshop: {
    nome: 'Pet Shop / Veterinária',
    prioridade: 'oportunidade',
    dor: 'Agendamento de banho e tosa manual, lembretes de vacina inexistentes',
    ticketMin: 297,
    ticketMax: 397,
    servicoIdeal: 'Agente WhatsApp + Agendamento + Lembretes de vacina',
    pacoteRecomendado: 'Start',
    potencialConversao: 40,
  },
} as const

export type SegmentoKey = keyof typeof segmentos
export type Segmento = typeof segmentos[SegmentoKey]

export const pacotes = {
  start: {
    nome: 'Start',
    precoPromo: 750,
    precoNormal: 997,
    descricao:
      'Atendimento automático 24h, FAQ inteligente, coleta de dados, horário de funcionamento',
    limiteConversas: 500,
    nichos: ['salao_beleza', 'oficina', 'petshop'],
  },
  growth: {
    nome: 'Growth',
    precoPromo: 1097,
    precoNormal: 1497,
    descricao:
      'Start + agendamento integrado, confirmação automática, lembrete D-1, catálogo',
    limiteConversas: 2000,
    nichos: ['salao_beleza', 'academia', 'restaurante'],
  },
  premium: {
    nome: 'Premium',
    precoPromo: 1797,
    precoNormal: 2497,
    descricao:
      'Growth + CRM básico, campanhas de reengajamento, relatório mensal personalizado',
    limiteConversas: 999999,
    nichos: ['clinica', 'restaurante'],
  },
} as const

export type PacoteKey = keyof typeof pacotes

// Mapeamento de palavras-chave de nicho → chave do segmento
const KEYWORD_MAP: [string[], SegmentoKey][] = [
  [
    ['salao', 'salon', 'beleza', 'cabeleireiro', 'cabeleireira', 'barbearia', 'barber', 'manicure', 'estetica', 'spa'],
    'salao_beleza',
  ],
  [
    ['restaurante', 'pizzaria', 'lanchonete', 'delivery', 'food', 'boteco', 'hamburger', 'burger', 'sushi', 'churrascaria', 'padaria', 'cafeteria', 'café'],
    'restaurante',
  ],
  [
    ['clinica', 'odonto', 'dentista', 'medico', 'medica', 'saude', 'fisioterapia', 'fisio', 'psicologia', 'nutricionista', 'farmacia', 'laboratorio'],
    'clinica',
  ],
  [
    ['oficina', 'mecanica', 'mecanico', 'automovel', 'carro', 'motor', 'funilaria', 'borracharia', 'auto'],
    'oficina',
  ],
  [
    ['academia', 'escola', 'curso', 'pilates', 'yoga', 'gym', 'fitness', 'dança', 'danca', 'natacao', 'futebol', 'musculacao'],
    'academia',
  ],
  [
    ['pet', 'animal', 'veterinaria', 'veterinário', 'banho', 'tosa', 'petshop'],
    'petshop',
  ],
]

/**
 * Retorna o segmento de mercado mais próximo dado um nicho em texto livre.
 * A busca é case-insensitive e ignora acentos.
 */
export function getSegmentoByNiche(niche: string): Segmento | null {
  if (!niche) return null

  const normalized = niche
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  for (const [keywords, key] of KEYWORD_MAP) {
    if (keywords.some((k) => normalized.includes(k))) {
      return segmentos[key]
    }
  }

  return null
}

/**
 * Retorna a chave do segmento (ex: "salao_beleza") ou null.
 */
export function getSegmentoKeyByNiche(niche: string): SegmentoKey | null {
  if (!niche) return null

  const normalized = niche
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  for (const [keywords, key] of KEYWORD_MAP) {
    if (keywords.some((k) => normalized.includes(k))) {
      return key
    }
  }

  return null
}
