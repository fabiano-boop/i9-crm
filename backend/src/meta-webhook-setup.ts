import axios from 'axios'
import * as dotenv from 'dotenv'
dotenv.config()

const {
  WHATSAPP_TOKEN,
  WHATSAPP_PHONE_ID,
  WHATSAPP_WABA_ID,
  WHATSAPP_VERIFY_TOKEN,
  BACKEND_URL,
} = process.env

const WEBHOOK_URL = `${BACKEND_URL}/api/webhooks/whatsapp`

const OK   = '\x1b[32m✓\x1b[0m'
const FAIL = '\x1b[31m✗\x1b[0m'
const INFO = '\x1b[36mℹ\x1b[0m'
const WARN = '\x1b[33m⚠\x1b[0m'
function log(icon: string, msg: string) { console.log(`  ${icon}  ${msg}`) }

async function checkEnvVars(): Promise<boolean> {
  console.log('\n📋 1. Verificando variáveis de ambiente...')
  const required = ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_ID', 'WHATSAPP_WABA_ID', 'WHATSAPP_VERIFY_TOKEN', 'BACKEND_URL']
  let ok = true
  for (const key of required) {
    if (process.env[key]) { log(OK, `${key} — definida`) }
    else { log(FAIL, `${key} — AUSENTE`); ok = false }
  }
  return ok
}

async function checkMetaToken(): Promise<boolean> {
  console.log('\n🔑 2. Validando token Meta...')
  try {
    const res = await axios.get(
      `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_ID}`,
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } },
    )
    log(OK, `Phone ID válido: ${(res.data as { display_phone_number?: string }).display_phone_number || WHATSAPP_PHONE_ID}`)
    return true
  } catch (err: unknown) {
    const e = err as { response?: { data?: { error?: { message?: string } } }; message?: string }
    log(FAIL, e.response?.data?.error?.message || e.message || String(err))
    return false
  }
}

async function checkBackendWebhook(): Promise<boolean> {
  console.log('\n🌐 3. Testando endpoint do backend...')
  const testUrl = `${WEBHOOK_URL}?hub.mode=subscribe&hub.verify_token=${WHATSAPP_VERIFY_TOKEN}&hub.challenge=TEST123`
  try {
    const res = await axios.get(testUrl)
    if (String(res.data).includes('TEST123') || res.status === 200) {
      log(OK, `Webhook OK em: ${WEBHOOK_URL}`)
      return true
    }
    log(WARN, `Resposta inesperada: ${JSON.stringify(res.data)}`)
    return false
  } catch (err: unknown) {
    const e = err as { message?: string }
    log(FAIL, `Erro: ${e.message || String(err)}`)
    return false
  }
}

async function sendTestMessage(testPhone: string): Promise<void> {
  console.log(`\n💬 4. Enviando mensagem de teste para ${testPhone}...`)
  try {
    const res = await axios.post<{ messages: { id: string }[] }>(
      `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: testPhone.replace(/\D/g, ''),
        type: 'text',
        text: { body: '✅ i9 CRM — Meta Cloud API oficial ativa! Maya online sem risco de ban.' },
      },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' } },
    )
    log(OK, `Mensagem enviada! ID: ${res.data.messages[0]?.id}`)
  } catch (err: unknown) {
    const e = err as { response?: { data?: { error?: { message?: string } } }; message?: string }
    log(FAIL, e.response?.data?.error?.message || e.message || String(err))
  }
}

async function main() {
  console.log('\n══════════════════════════════════════════════')
  console.log('  i9 CRM — Validação Meta Cloud API')
  console.log('══════════════════════════════════════════════')

  const envOk = await checkEnvVars()
  if (!envOk) { console.log('\n❌ Corrija as variáveis antes de continuar.\n'); process.exit(1) }

  const tokenOk   = await checkMetaToken()
  const backendOk = await checkBackendWebhook()

  const testPhone = process.argv[2]
  if (testPhone) await sendTestMessage(testPhone)
  else log(INFO, 'Para testar envio: npx ts-node meta-webhook-setup.ts 5511999999999')

  console.log('\n══════════════════════════════════════════════')
  console.log(`  Token Meta:      ${tokenOk   ? '✅ OK' : '❌ FALHOU'}`)
  console.log(`  Backend webhook: ${backendOk ? '✅ OK' : '❌ FALHOU'}`)
  console.log('\n  Próximos passos:')
  console.log('  1. Adicionar WHATSAPP_TOKEN no Railway após gerar amanhã')
  console.log('  2. Registrar webhook no painel Meta:')
  console.log(`     URL: ${WEBHOOK_URL}`)
  console.log(`     Verify Token: ${WHATSAPP_VERIFY_TOKEN}`)
  console.log('     Campos: messages, message_deliveries, message_reads')
  console.log('══════════════════════════════════════════════\n')
}

// Silencia variáveis não usadas diretamente (usadas no runtime via process.env)
void WHATSAPP_WABA_ID

main().catch(console.error)
