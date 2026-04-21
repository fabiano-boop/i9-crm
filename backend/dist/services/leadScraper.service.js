"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runLeadScraper = runLeadScraper;
const axios_1 = __importDefault(require("axios"));
const client_1 = require("@prisma/client");
const leadScorer_js_1 = require("../utils/leadScorer.js");
const prisma = new client_1.PrismaClient();
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const BAIRROS = [
    'Mooca', 'Tatuapé', 'Penha', 'Itaquera', 'São Mateus',
    'Sapopemba', 'Aricanduva', 'Vila Prudente', 'Carrão',
    'Belém', 'Água Rasa', 'Vila Formosa', 'Cangaíba',
    'Ermelino Matarazzo', 'Guaianases', 'Cidade Tiradentes',
    'São Miguel Paulista', 'Radial Leste'
];
const SEGMENTOS = [
    { query: 'salão de beleza', nicho: 'Beleza' },
    { query: 'clínica odontológica', nicho: 'Saúde' },
    { query: 'restaurante', nicho: 'Alimentação' },
    { query: 'pet shop', nicho: 'Pet' },
    { query: 'academia de ginástica', nicho: 'Fitness' },
    { query: 'oficina mecânica', nicho: 'Automotivo' },
    { query: 'padaria', nicho: 'Alimentação' },
    { query: 'clínica estética', nicho: 'Estética' },
    { query: 'escola infantil', nicho: 'Educação' },
    { query: 'clínica veterinária', nicho: 'Pet' },
];
function gerarDorEAngulo(place, segmento, bairro) {
    const temSite = !!place.websiteUri;
    const rating = place.rating || 0;
    const avaliacoes = place.userRatingCount || 0;
    const nome = place.displayName.text;
    // Sem site
    if (!temSite) {
        return {
            dor: 'Não tem site — clientes não conseguem encontrar informações online e você perde vendas fora do horário de funcionamento',
            angulo: `${nome}, fiz uma busca por "${segmento.query}" em ${bairro} e seu negócio não tem site — seus concorrentes aparecem primeiro e capturam os clientes que seriam seus.`,
            servicoRecomendado: 'site',
        };
    }
    // Rating baixo
    if (rating > 0 && rating < 3.5) {
        return {
            dor: 'Avaliações baixas no Google afastam clientes antes mesmo de entrarem em contato',
            angulo: `${nome}, vi que vocês têm ${rating} estrelas no Google — uma estratégia simples de reputação online pode reverter isso e atrair mais clientes em ${bairro}.`,
            servicoRecomendado: 'trafego',
        };
    }
    // Poucas avaliações
    if (avaliacoes < 20) {
        return {
            dor: 'Pouquíssimas avaliações no Google — o negócio está invisível para quem busca online',
            angulo: `${nome}, fiz uma busca por "${segmento.query}" em ${bairro} e seu negócio aparece com apenas ${avaliacoes} avaliações — a concorrência tem muito mais visibilidade.`,
            servicoRecomendado: 'trafego',
        };
    }
    // Rating bom mas sem site (caso não capturado acima por ordem)
    if (rating >= 4.0 && !temSite) {
        return {
            dor: 'Ótima reputação mas sem presença digital forte para escalar',
            angulo: `${nome}, vocês têm ${rating} estrelas no Google — com um site e landing page profissional, essa reputação se transforma em muito mais clientes.`,
            servicoRecomendado: 'landing_page',
        };
    }
    // Fallback por nicho
    const DORES_POR_NICHO = {
        'Beleza': { dor: 'Clientes somem após a primeira visita e o negócio depende só do boca a boca', servicoRecomendado: 'site' },
        'Saúde': { dor: 'Agenda vazia nos horários da manhã e dificuldade de atrair pacientes novos', servicoRecomendado: 'landing_page' },
        'Alimentação': { dor: 'Movimento fraco nos dias de semana e concorrência com apps de delivery', servicoRecomendado: 'trafego' },
        'Pet': { dor: 'Poucos tutores conhecem o negócio fora do bairro imediato', servicoRecomendado: 'trafego' },
        'Fitness': { dor: 'Alta rotatividade de alunos e dificuldade de reter após o verão', servicoRecomendado: 'landing_page' },
        'Automotivo': { dor: 'Clientes só aparecem quando o carro quebra, sem fidelização', servicoRecomendado: 'site' },
        'Estética': { dor: 'Dificuldade em vender pacotes e depender só de indicação', servicoRecomendado: 'landing_page' },
        'Educação': { dor: 'Matrículas concentradas em janeiro e vagas ociosas o resto do ano', servicoRecomendado: 'site' },
    };
    const nicho = DORES_POR_NICHO[segmento.nicho] ?? { dor: 'Dificuldade em atrair clientes novos online', servicoRecomendado: 'trafego' };
    return {
        dor: nicho.dor,
        angulo: `${nome}, fiz uma busca por "${segmento.query}" em ${bairro} e vi uma oportunidade clara de trazer mais clientes pro seu negócio.`,
        servicoRecomendado: nicho.servicoRecomendado,
    };
}
async function searchPlaces(query, bairro) {
    try {
        const response = await axios_1.default.post('https://places.googleapis.com/v1/places:searchText', {
            textQuery: `${query} em ${bairro} São Paulo`,
            languageCode: 'pt-BR',
            regionCode: 'BR',
            maxResultCount: 20,
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_API_KEY,
                'X-Goog-FieldMask': [
                    'places.id',
                    'places.displayName',
                    'places.nationalPhoneNumber',
                    'places.internationalPhoneNumber',
                    'places.formattedAddress',
                    'places.websiteUri',
                    'places.rating',
                    'places.userRatingCount',
                ].join(','),
            },
        });
        return response.data.places || [];
    }
    catch (error) {
        console.error(`[Scraper] Erro na busca "${query} em ${bairro}":`, error.message);
        return [];
    }
}
function extractPhone(place) {
    const raw = place.nationalPhoneNumber || place.internationalPhoneNumber;
    if (!raw)
        return null;
    return raw.replace(/\D/g, '');
}
async function runLeadScraper() {
    console.log('[Scraper] Iniciando varredura diária da Zona Leste...');
    let inserted = 0;
    let skipped = 0;
    for (const segmento of SEGMENTOS) {
        for (const bairro of BAIRROS) {
            console.log(`[Scraper] Buscando: ${segmento.query} em ${bairro}`);
            const places = await searchPlaces(segmento.query, bairro);
            for (const place of places) {
                const phone = extractPhone(place);
                if (!phone) {
                    skipped++;
                    continue;
                }
                // Verifica duplicata por telefone
                const existing = await prisma.lead.findFirst({
                    where: { phone },
                });
                if (existing) {
                    skipped++;
                    continue;
                }
                const score = (0, leadScorer_js_1.calculateLeadScore)({
                    name: place.displayName.text,
                    phone,
                    website: place.websiteUri,
                    rating: place.rating,
                    userRatingsTotal: place.userRatingCount,
                });
                const temperature = (0, leadScorer_js_1.getLeadTemperature)(score);
                const { dor, angulo, servicoRecomendado } = gerarDorEAngulo(place, segmento, bairro);
                await prisma.lead.create({
                    data: {
                        name: place.displayName.text,
                        businessName: place.displayName.text,
                        niche: segmento.nicho,
                        neighborhood: bairro,
                        address: place.formattedAddress || `${bairro}, São Paulo - SP`,
                        phone: phone,
                        whatsapp: phone,
                        website: place.websiteUri || null,
                        score,
                        classification: temperature,
                        whatsappAngle: angulo,
                        painPoints: dor,
                        idealService: servicoRecomendado,
                        source: 'google_places_scraper',
                        status: 'NEW',
                        googleRating: place.rating || null,
                        reviewCount: place.userRatingCount || null,
                    },
                });
                inserted++;
                console.log(`[Scraper] ✅ Lead inserido: ${place.displayName.text} (${bairro}) | Score: ${score}`);
            }
            // Delay entre buscas para respeitar rate limit
            await new Promise(r => setTimeout(r, 300));
        }
    }
    console.log(`[Scraper] Finalizado. Inseridos: ${inserted} | Ignorados (sem tel ou duplicata): ${skipped}`);
}
//# sourceMappingURL=leadScraper.service.js.map