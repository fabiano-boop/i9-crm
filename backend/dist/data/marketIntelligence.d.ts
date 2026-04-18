export declare const segmentos: {
    readonly salao_beleza: {
        readonly nome: "Salão de Beleza";
        readonly prioridade: "alta";
        readonly dor: "Confirmação de agendamentos manual, no-show de 20-30% das vagas";
        readonly ticketMin: 297;
        readonly ticketMax: 497;
        readonly servicoIdeal: "Agente WhatsApp + Lembretes automáticos";
        readonly pacoteRecomendado: "Pro";
        readonly potencialConversao: 85;
    };
    readonly restaurante: {
        readonly nome: "Restaurante / Delivery";
        readonly prioridade: "alta";
        readonly dor: "Pedidos no WhatsApp de forma caótica, dependência de funcionário para atender";
        readonly ticketMin: 397;
        readonly ticketMax: 697;
        readonly servicoIdeal: "Agente WhatsApp + Cardápio digital + Delivery próprio";
        readonly pacoteRecomendado: "Premium";
        readonly potencialConversao: 80;
    };
    readonly clinica: {
        readonly nome: "Clínica Odonto/Médica";
        readonly prioridade: "media";
        readonly dor: "Recepcionista sobrecarregada, cancelamentos de última hora";
        readonly ticketMin: 497;
        readonly ticketMax: 897;
        readonly servicoIdeal: "Agente WhatsApp + Triagem automática + Confirmação de consultas";
        readonly pacoteRecomendado: "Premium";
        readonly potencialConversao: 55;
    };
    readonly oficina: {
        readonly nome: "Oficina Mecânica";
        readonly prioridade: "media";
        readonly dor: "Cliente pergunta preço no WhatsApp, mecânico para trabalho para responder";
        readonly ticketMin: 297;
        readonly ticketMax: 497;
        readonly servicoIdeal: "Agente WhatsApp + Orçamentos automáticos + Status do carro";
        readonly pacoteRecomendado: "Básico";
        readonly potencialConversao: 50;
    };
    readonly academia: {
        readonly nome: "Academia / Escola";
        readonly prioridade: "media";
        readonly dor: "Matrículas por mensagem, dúvidas sobre horários, renovação de plano manual";
        readonly ticketMin: 297;
        readonly ticketMax: 497;
        readonly servicoIdeal: "Agente WhatsApp + Matrícula online + Lembretes de renovação";
        readonly pacoteRecomendado: "Pro";
        readonly potencialConversao: 45;
    };
    readonly petshop: {
        readonly nome: "Pet Shop / Veterinária";
        readonly prioridade: "oportunidade";
        readonly dor: "Agendamento de banho e tosa manual, lembretes de vacina inexistentes";
        readonly ticketMin: 297;
        readonly ticketMax: 397;
        readonly servicoIdeal: "Agente WhatsApp + Agendamento + Lembretes de vacina";
        readonly pacoteRecomendado: "Básico";
        readonly potencialConversao: 40;
    };
};
export type SegmentoKey = keyof typeof segmentos;
export type Segmento = typeof segmentos[SegmentoKey];
export declare const pacotes: {
    readonly basico: {
        readonly nome: "Básico";
        readonly preco: 297;
        readonly descricao: "Atendimento automático 24h, FAQ inteligente, coleta de dados, horário de funcionamento";
        readonly limiteConversas: 500;
        readonly nichos: readonly ["salao_beleza", "oficina", "petshop"];
    };
    readonly pro: {
        readonly nome: "Pro";
        readonly preco: 497;
        readonly descricao: "Básico + agendamento integrado, confirmação automática, lembrete D-1, catálogo";
        readonly limiteConversas: 2000;
        readonly nichos: readonly ["salao_beleza", "academia", "restaurante"];
    };
    readonly premium: {
        readonly nome: "Premium";
        readonly preco: 897;
        readonly descricao: "Pro + CRM básico, campanhas de reengajamento, relatório mensal personalizado";
        readonly limiteConversas: 999999;
        readonly nichos: readonly ["clinica", "restaurante"];
    };
};
export type PacoteKey = keyof typeof pacotes;
/**
 * Retorna o segmento de mercado mais próximo dado um nicho em texto livre.
 * A busca é case-insensitive e ignora acentos.
 */
export declare function getSegmentoByNiche(niche: string): Segmento | null;
/**
 * Retorna a chave do segmento (ex: "salao_beleza") ou null.
 */
export declare function getSegmentoKeyByNiche(niche: string): SegmentoKey | null;
//# sourceMappingURL=marketIntelligence.d.ts.map