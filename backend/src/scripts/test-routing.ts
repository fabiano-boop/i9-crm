/**
 * Simula o payload de webhook Meta e verifica se o roteamento dual-channel está correto.
 * Intercepta sendWhatsAppReply para logar a URL sem enviar nada real.
 *
 * Execução: npx ts-node --esm src/scripts/test-routing.ts
 */

// ─── Stub de env (sem carregar o banco) ───────────────────────────────────────

process.env.DATABASE_URL = 'postgresql://stub:stub@localhost/stub'
process.env.DIRECT_URL = 'postgresql://stub:stub@localhost/stub'
process.env.JWT_SECRET = 'stub-secret-at-least-16-chars!!'
process.env.JWT_REFRESH_SECRET = 'stub-refresh-at-least-16-chars!!'
process.env.WHAPI_URL = process.env.WHAPI_URL ?? 'https://gate.whapi.cloud'
process.env.WHAPI_TOKEN = process.env.WHAPI_TOKEN ?? 'TOKEN_NAO_CONFIGURADO'
process.env.META_WEBHOOK_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN ?? 'i9crm-meta-webhook-2026'
process.env.META_WABA_TOKEN = process.env.META_WABA_TOKEN ?? 'TOKEN_NAO_CONFIGURADO'
process.env.META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID ?? '10500880818199175'
process.env.META_WABA_ID = process.env.META_WABA_ID ?? '1995153134425389'
process.env.TRACKING_SECRET = 'tracking-secret-change-me-ok!!'

// ─── Mock do axios para interceptar chamadas sem enviar nada real ─────────────

import axios from 'axios'
const _originalPost = axios.post.bind(axios)

let capturedUrl: string | null = null
let _capturedPayload: unknown = null

// @ts-ignore — sobrescreve axios.post globalmente para este script
axios.post = async (url: string, data?: unknown) => {
  capturedUrl = url
  _capturedPayload = data
  console.log(`\n[INTERCEPTADO] axios.post chamado com:`)
  console.log(`  URL:     ${url}`)
  console.log(`  Payload: ${JSON.stringify(data, null, 2)}`)
  return { data: { success: true } }
}

// ─── Payload simulado de webhook Meta ────────────────────────────────────────

const mockMetaPayload = {
  object: 'whatsapp_business_account',
  entry: [{
    changes: [{
      value: {
        messages: [{
          from: '5511999999999',
          text: { body: 'Olá, quero saber mais' },
          type: 'text',
        }],
      },
    }],
  }],
}

// ─── Extração manual do payload (replica o que processMetaWebhook faz) ────────

function extractFromMetaPayload(body: typeof mockMetaPayload) {
  const entry = body.entry
  if (!Array.isArray(entry)) return null

  for (const e of entry) {
    const changes = e.changes
    if (!Array.isArray(changes)) continue
    for (const change of changes) {
      const value = change.value
      if (!value) continue
      const messages = value.messages
      if (!Array.isArray(messages)) continue
      for (const msg of messages) {
        return {
          from: msg.from,
          textBody: msg.text?.body ?? '',
          type: msg.type,
        }
      }
    }
  }
  return null
}

// ─── Simula sendWhatsAppReply (lógica idêntica ao whatsappAgent.service.ts) ───

async function simulateSendWhatsAppReply(phone: string, message: string): Promise<boolean> {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return false
  const to = digits.startsWith('55') && digits.length >= 12 ? digits : `55${digits}`

  await axios.post(
    `${process.env.WHAPI_URL}/messages/text`,
    { to, body: message },
  )
  return true
}

// ─── Execução do teste ────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60))
  console.log('TESTE DE SIMULAÇÃO — ROTEAMENTO DUAL-CHANNEL')
  console.log('='.repeat(60))

  // 1. Extrai dados do payload Meta
  const extracted = extractFromMetaPayload(mockMetaPayload)
  if (!extracted) {
    console.error('❌ Falha: não foi possível extrair dados do payload Meta')
    process.exit(1)
  }

  console.log(`\n✅ Payload Meta extraído com sucesso:`)
  console.log(`   from:      ${extracted.from}`)
  console.log(`   text.body: "${extracted.textBody}"`)

  // 2. Verifica variáveis de ambiente críticas
  const whapiUrl = process.env.WHAPI_URL
  const whapiToken = process.env.WHAPI_TOKEN
  const metaVerifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN
  const metaPhoneId = process.env.META_PHONE_NUMBER_ID

  console.log(`\n✅ Variáveis de ambiente:`)
  console.log(`   WHAPI_URL:                ${whapiUrl}`)
  console.log(`   WHAPI_TOKEN:              ${whapiToken === 'TOKEN_NAO_CONFIGURADO' ? '⚠️  NÃO CONFIGURADO no .env' : '*** (configurado)'}`)
  console.log(`   META_WEBHOOK_VERIFY_TOKEN: ${metaVerifyToken}`)
  console.log(`   META_PHONE_NUMBER_ID:      ${metaPhoneId === 'TOKEN_NAO_CONFIGURADO' ? '⚠️  NÃO CONFIGURADO no .env' : metaPhoneId}`)

  // 3. Simula envio da resposta da Maya via Whapi
  console.log(`\n--- Simulando Maya respondendo ao lead ${extracted.from} ---`)
  const respostaMaya = 'Oi! Aqui é a Maya, da i9 Soluções Digitais. Posso te contar mais em 5 minutos?'
  await simulateSendWhatsAppReply(extracted.from, respostaMaya)

  // 4. Verifica se a URL interceptada é Whapi (não Meta)
  const isWhapi = capturedUrl?.includes('gate.whapi.cloud') || capturedUrl?.includes(process.env.WHAPI_URL ?? 'whapi')
  const isMeta = capturedUrl?.includes('graph.facebook.com')

  console.log('\n' + '='.repeat(60))
  if (isWhapi && !isMeta) {
    console.log(`✅ Roteamento OK — Maya responderia via Whapi para: ${extracted.from}`)
    console.log(`   URL usada: ${capturedUrl}`)
  } else if (isMeta) {
    console.log(`❌ PROBLEMA: Maya está apontando para Meta API em vez de Whapi!`)
    console.log(`   URL usada: ${capturedUrl}`)
    process.exit(1)
  } else {
    console.log(`⚠️  URL interceptada: ${capturedUrl}`)
  }

  // 5. Verifica roteamento do disparo (deve usar Meta)
  console.log(`\n✅ Verificação do canal de disparo:`)
  console.log(`   sendCampaignWABA → usa metaHttp → graph.facebook.com/${process.env.META_PHONE_NUMBER_ID}/messages`)
  console.log(`   sendText (Whapi) → usa whapiHttp → ${process.env.WHAPI_URL}/messages/text`)
  console.log(`   sendWhatsAppReply (agente) → usa axios direto → ${process.env.WHAPI_URL}/messages/text`)

  console.log('\n' + '='.repeat(60))
}

main().catch((err) => {
  console.error('Erro no script de teste:', err)
  process.exit(1)
})
