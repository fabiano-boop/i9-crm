import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const router = Router();
const prisma = new PrismaClient();

const VERIFY_TOKEN = 'i9crm_meta_leads_2025';

router.get('/meta-webhook', (req: Request, res: Response): void => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Meta Webhook] Verificação aprovada ✅');
    res.status(200).send(challenge);
    return;
  }

  console.warn('[Meta Webhook] Verificação falhou ❌', { mode, token });
  res.sendStatus(403);
});

router.post('/meta-webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body;
    if (body.object !== 'page') { res.sendStatus(404); return; }
    res.sendStatus(200);

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'leadgen') continue;
        const leadId  = change.value?.leadgen_id;
        const adId    = change.value?.ad_id;
        const formId  = change.value?.form_id;
        if (!leadId) continue;

        const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
        if (!PAGE_ACCESS_TOKEN) continue;

        const graphRes = await axios.get(
          `https://graph.facebook.com/v19.0/${leadId}`,
          { params: { access_token: PAGE_ACCESS_TOKEN } }
        );

        const fieldData: { name: string; values: string[] }[] = graphRes.data?.field_data || [];
        const getValue = (fieldName: string) => fieldData.find(f => f.name === fieldName)?.values?.[0] || '';

        const nome        = getValue('full_name') || getValue('first_name');
        const whatsapp    = getValue('whatsapp_number') || getValue('phone_number');
        const tipoNegocio = getValue('qual_é_o_seu_tipo_de_negócio?') || getValue('business_type') || 'Não informado';

        if (!nome && !whatsapp) continue;

        const lead = await prisma.lead.create({
          data: {
            nome:        nome || 'Lead Meta Ads',
            telefone:    whatsapp,
            origem:      'META_ADS' as any,
            status:      'NOVO' as any,
            observacoes: `Tipo de negócio: ${tipoNegocio} | Ad ID: ${adId} | Form ID: ${formId}`,
          },
        });

        console.log(`[Meta Webhook] Lead salvo ✅ ID: ${lead.id} | ${nome} | ${whatsapp}`);
      }
    }
  } catch (error: any) {
    console.error('[Meta Webhook] Erro:', error?.message || error);
  }
});

export default router;
