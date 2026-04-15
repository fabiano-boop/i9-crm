// ─── Biblioteca de Contornos de Objeção — Agente Maya ───────────────────────
//
// Cada entrada contém:
//   key        → identificador único
//   title      → nome da objeção
//   triggers   → palavras/frases que indicam esta objeção
//   strategy   → instrução para o Claude sobre como lidar
//   escalate   → se true, considerar handoff imediato
// ─────────────────────────────────────────────────────────────────────────────

export interface ObjectionEntry {
  key: string
  title: string
  triggers: string[]
  strategy: string
  escalate?: boolean
}

export const OBJECTION_LIBRARY: ObjectionEntry[] = [
  // ── Preço ──────────────────────────────────────────────────────────────────
  {
    key: 'preco_caro',
    title: 'Preço muito caro',
    triggers: ['caro', 'custa muito', 'muito dinheiro', 'não tenho esse valor',
               'valor alto', 'não consigo pagar', 'sem condições', 'fora do orçamento'],
    strategy: `Não defenda o preço — contextualize o ROI.
Faça uma pergunta de reflexão: "Quanto vale um cliente novo por mês pro seu negócio?"
Mostre o math: se o pacote traz 3 clientes e o ticket médio é X, o retorno aparece rápido.
Se ainda resistir, apresente o Starter como entrada e mencione a possibilidade de upgrade.
Nunca ofereça desconto sem passar para humano.`,
  },
  {
    key: 'preco_negociacao',
    title: 'Quer desconto ou negociar',
    triggers: ['desconto', 'valor menor', 'mais barato', 'tem desconto',
               'consigo por menos', 'negocia', 'reduz o valor'],
    strategy: `Agradeça o interesse em fechar. Diga que precisa consultar um especialista para verificar condições especiais.
Não prometa desconto — passe para humano imediatamente com urgency='high'.`,
    escalate: true,
  },

  // ── Concorrência / já tem alguém ───────────────────────────────────────────
  {
    key: 'ja_tem_agencia',
    title: 'Já tem agência ou profissional',
    triggers: ['já tenho agência', 'já trabalho com', 'tenho alguém', 'tem parceiro',
               'já tem uma pessoa', 'já invisto em marketing', 'já uso'],
    strategy: `Não confronte a solução atual. Mostre curiosidade genuína:
"Que ótimo! Tá satisfeito com os resultados? Tem chegado quantos clientes novos por mês por lá?"
Se mostrar insatisfação ou incerteza, abra espaço para comparar abordagens.
Se satisfeito, plante a semente: "Faz sentido — se um dia quiser comparar resultados, estarei aqui."`,
  },
  {
    key: 'faz_sozinho',
    title: 'Faz o marketing sozinho',
    triggers: ['faço eu mesmo', 'eu cuido', 'minha filha faz', 'meu sobrinho faz',
               'tenho funcionário', 'eu mesmo posto', 'faço as redes sociais'],
    strategy: `Valorize o esforço. Mostre o que escapa quando a gestão é amadora:
"Legal que você já cuida! A diferença com a i9 é que a gente trabalha com meta de cliente — não só de post bonito."
Ofereça uma comparação simples de resultados possíveis.`,
  },

  // ── Tempo / urgência ───────────────────────────────────────────────────────
  {
    key: 'sem_tempo',
    title: 'Sem tempo agora',
    triggers: ['sem tempo', 'muito ocupado', 'agora não', 'depois', 'mais tarde',
               'tô corrido', 'semana que vem', 'me manda mais tarde'],
    strategy: `Respeite. Ofereça o menor compromisso possível:
"Entendo! Manda uma mensagem quando tiver 10 minutinhos que a gente resolve rapidinho por aqui mesmo, sem precisar de reunião."
Agende follow-up em 3 dias se não responder.`,
  },
  {
    key: 'nao_hora_certa',
    title: 'Não é o momento certo',
    triggers: ['momento difícil', 'agora não é hora', 'esperando melhorar',
               'quando as coisas melhorarem', 'depois que passar'],
    strategy: `Valide o contexto dele. Pergunte sobre o cenário atual sem pressionar.
"Entendo o momento. Mas é exatamente nesses períodos que a presença digital faz diferença — os concorrentes que ficam quietos perdem espaço."
Convide para uma conversa sem compromisso sobre o que poderia mudar mais rápido.`,
  },

  // ── Descrença / ceticismo ──────────────────────────────────────────────────
  {
    key: 'nao_acredita',
    title: 'Não acredita em marketing digital',
    triggers: ['não funciona', 'não adianta', 'já tentei', 'perda de dinheiro',
               'não dá resultado', 'gastei e não adiantou', 'propaganda não resolve'],
    strategy: `Valide a frustração sem atacar o que foi feito antes.
"Entendo essa sensação — a maioria das agências vende post e não entrega cliente. A i9 é diferente: trabalhamos com meta de resultado, não de curtida."
Pergunte o que foi feito antes especificamente. Use um caso de sucesso do mesmo nicho ou bairro se tiver.`,
  },
  {
    key: 'nao_precisa',
    title: 'Acha que não precisa de marketing',
    triggers: ['não preciso', 'tô bem', 'clientes já aparecem', 'boca a boca funciona',
               'não vejo necessidade', 'meu negócio vai bem'],
    strategy: `Não confronte o sucesso. Posicione como proteção do que já tem:
"Que ótimo! E se o boca a boca parar um mês? A i9 cria um canal digital que não depende de indicação."
Faça uma pergunta: "Quanto por cento dos seus clientes vêm do Google hoje?"`,
  },

  // ── Reflexão / procrastinação ──────────────────────────────────────────────
  {
    key: 'precisa_pensar',
    title: 'Precisa pensar / decidir depois',
    triggers: ['preciso pensar', 'vou pensar', 'deixa eu pensar',
               'vou ver', 'me dá um tempo', 'deixa eu avaliar'],
    strategy: `Não pressione. Ajude a estruturar a decisão:
"Claro! O que faria sentido: te mando um resumo por aqui e marcamos uma conversa rápida na terça ou quarta?"
Se não confirmar data, pergunte: "O que precisaria acontecer pra fazer sentido pra você?"`,
  },
  {
    key: 'falar_socio',
    title: 'Precisa falar com sócio ou cônjuge',
    triggers: ['preciso falar com sócio', 'comentar com minha esposa', 'falar com meu marido',
               'consultar parceiro', 'ver com o dono', 'falar com a família'],
    strategy: `Respeite. Facilite a conversa que ele vai ter:
"Faz sentido! Quer que eu mande um resumo bem simples que você possa mostrar pra ele/ela? Fica mais fácil de explicar."
Ofereça uma reunião curta com o sócio incluído.`,
  },

  // ── Rejeição clara ─────────────────────────────────────────────────────────
  {
    key: 'nao_quer',
    title: 'Rejeição direta',
    triggers: ['não quero', 'não tenho interesse', 'pode tirar', 'tire meu número',
               'não me contate', 'para de me mandar mensagem', 'não me incomode'],
    strategy: `Respeite imediatamente e de forma calorosa:
"Tudo certo! Peço desculpa pela inconveniência. Boa sorte com o [negócio]! Se um dia precisar, estou aqui."
Marcar como NOT_INTERESTED e sinalizar HUMAN_NEEDED para atualizar o CRM corretamente.`,
    escalate: true,
  },

  // ── Dúvida técnica / resultado ─────────────────────────────────────────────
  {
    key: 'quer_garantia',
    title: 'Quer garantia de resultado',
    triggers: ['garante resultado', 'e se não funcionar', 'e se não der certo',
               'tem garantia', 'devolve o dinheiro'],
    strategy: `Seja honesto — não faça promessa de resultado garantido.
"A gente não garante número de clientes porque depende de vários fatores do negócio. Mas mostramos cases reais e trabalhamos com meta — se não estiver entregando, a gente ajusta antes de cobrar."
Convide para conversa com especialista se a objeção persistir.`,
  },
  {
    key: 'quer_ver_trabalho',
    title: 'Quer ver trabalhos ou cases',
    triggers: ['tem portfólio', 'posso ver trabalho', 'tem cliente parecido',
               'quero ver exemplo', 'case de sucesso', 'referência'],
    strategy: `Excelente sinal de interesse! Informe que pode compartilhar cases do mesmo nicho:
"Com certeza! Temos clientes no mesmo segmento aqui na Zona Leste. Posso te passar o contato de um deles ou mostrar os resultados. Qual prefere?"
Passe para humano se precisar de materials específicos.`,
    escalate: true,
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Detecta a objeção mais relevante na mensagem recebida */
export function detectObjection(message: string): ObjectionEntry | null {
  const lower = message.toLowerCase()
  // Ordena por número de triggers para priorizar objeções mais específicas
  const sorted = [...OBJECTION_LIBRARY].sort((a, b) => b.triggers.length - a.triggers.length)
  for (const obj of sorted) {
    if (obj.triggers.some((t) => lower.includes(t.toLowerCase()))) {
      return obj
    }
  }
  return null
}

/** Gera o bloco de contexto a injetar no prompt do Claude */
export function getObjectionContext(message: string): string {
  const obj = detectObjection(message)
  if (!obj) return ''
  return `\n\n[OBJEÇÃO IDENTIFICADA: "${obj.title}"]
ESTRATÉGIA PARA MAYA:
${obj.strategy}
${obj.escalate ? '\n⚠️ ATENÇÃO: esta objeção sugere considerar handoff para humano.' : ''}`
}

/** Retorna se a objeção detectada requer escalação imediata */
export function requiresImmediateEscalation(message: string): boolean {
  const obj = detectObjection(message)
  return obj?.escalate === true
}
