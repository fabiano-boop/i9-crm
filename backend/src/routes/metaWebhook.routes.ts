import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const router = Router();
const prisma = new PrismaClient();

// Token de verificação — pode ser qualquer string, você vai colar no Meta Developer
const VERIFY_TOKEN = 'i9crm_meta_leads_2025';

// ─── GET: Verificação do webhook pela Meta ───────────────────────────────────
router.get('/meta-webhook', (req: Request, res: Response) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Meta Webhook] Verificação aprovada ✅');
    return res.status(200).send(challenge);
  }

  console.warn('[Meta Webhook] Verificação falhou ❌', { mode, token });
  return res.sendStatus(403);
});

// ─── POST: Receber leads da Meta ─────────────────────────────────────────────
router.post('/meta-webhook', async (req: Request, res: Response) => {
  try {
    const body = req.body;

    // Confirma que é um evento de leadgen
    if (body.object !== 'page') {
      return res.sendStatus(404);
    }

    // Responde imediatamente para a Meta não reenviar
    res.sendStatus(200);

    // Processa cada entrada
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'leadgen') continue;

        const leadId    = change.value?.leadgen_id;
        const pageId    = change.value?.page_id;
        const adId      = change.value?.ad_id;
        const formId    = change.value?.form_id;

        if (!leadId) continue;

        console.log(`[Meta Webhook] Novo lead recebido: ${leadId}`);

        // Busca os dados do lead na Graph API
        const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;

        if (!PAGE_ACCESS_TOKEN) {
          console.error('[Meta Webhook] META_PAGE_ACCESS_TOKEN não configurado');
          continue;
        }

        const graphRes = await axios.get(
          `https://graph.facebook.com/v19.0/${leadId}`,
          { params: { access_token: PAGE_ACCESS_TOKEN } }
        );

        const fieldData: { name: string; values: string[] }[] =
          graphRes.data?.field_data || [];

        // Extrai os campos do formulário
        const getValue = (fieldName: string) =>
          fieldData.find(f => f.name === fieldName)?.values?.[0] || '';

        const nome        = getValue('full_name') || getValue('first_name');
        const whatsapp    = getValue('whatsapp_number') || getValue('phone_number');
        const tipoNegocio = getValue('qual_é_o_seu_tipo_de_negócio?') ||
                            getValue('business_type') || 'Não informado';

        if (!nome && !whatsapp) {
          console.warn('[Meta Webhook] Lead sem dados suficientes', fieldData);
          continue;
        }

        // Salva no Supabase via Prisma
        const lead = await prisma.lead.create({
          data: {
            nome:   nome || 'Lead Meta Ads',
            telefone: whatsapp,
            origem: 'META_ADS',
            status: 'NOVO',
            observacoes: `Tipo de negócio: ${tipoNegocio} | Ad ID: ${adId} | Form ID: ${formId}`,
          },
        });

        console.log(`[Meta Webhook] Lead salvo no CRM ✅ ID: ${lead.id} | ${nome} | ${whatsapp}`);
      }
    }

  } catch (error: any) {
    console.error('[Meta Webhook] Erro ao processar lead:', error?.message || error);
  }
});

export default router;