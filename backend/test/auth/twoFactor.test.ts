import request from 'supertest'
import { app } from '../../src/server.js'
import { prisma } from '../../src/config/database.js'
import bcrypt from 'bcryptjs'
import speakeasy from 'speakeasy'

const testEmail = `test2fa+${Date.now()}@i9test.com`
let accessToken: string

beforeAll(async () => {
  await prisma.user.create({
    data: {
      name: 'Teste 2FA',
      email: testEmail,
      passwordHash: await bcrypt.hash('senha123', 10),
      role: 'AGENT',
    },
  })
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: testEmail, password: 'senha123' })
  accessToken = res.body.accessToken
})

afterAll(async () => {
  await prisma.twoFactorSecret.deleteMany({ where: { user: { email: testEmail } } })
  await prisma.user.deleteMany({ where: { email: testEmail } })
  await prisma.$disconnect()
})

describe('2FA flow', () => {
  let secret: string

  it('GET /2fa/status → enabled: false inicialmente', async () => {
    const res = await request(app)
      .get('/api/auth/2fa/status')
      .set('Authorization', `Bearer ${accessToken}`)
    expect(res.status).toBe(200)
    expect(res.body.enabled).toBe(false)
  })

  it('POST /2fa/setup → retorna qrCode e secret', async () => {
    const res = await request(app)
      .post('/api/auth/2fa/setup')
      .set('Authorization', `Bearer ${accessToken}`)
    expect(res.status).toBe(200)
    expect(res.body.qrCode).toMatch(/^data:image\/png/)
    expect(res.body.secret).toBeTruthy()
    secret = res.body.secret
  })

  it('POST /2fa/verify com código válido → ativa 2FA', async () => {
    const token = speakeasy.totp({ secret, encoding: 'base32' })
    const res = await request(app)
      .post('/api/auth/2fa/verify')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ token })
    expect(res.status).toBe(200)
    expect(res.body.enabled).toBe(true)
  })

  it('Login com 2FA ativo → retorna requiresTwoFactor', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'senha123' })
    expect(res.status).toBe(200)
    expect(res.body.requiresTwoFactor).toBe(true)
    expect(res.body.tempToken).toBeTruthy()
  })

  it('POST /2fa/validate → retorna tokens definitivos', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'senha123' })
    const { tempToken } = loginRes.body as { tempToken: string }
    const token = speakeasy.totp({ secret, encoding: 'base32' })
    const res = await request(app)
      .post('/api/auth/2fa/validate')
      .send({ tempToken, token })
    expect(res.status).toBe(200)
    expect(res.body.accessToken).toBeTruthy()
    expect(res.body.user).toBeDefined()
  })

  it('POST /2fa/disable → desativa 2FA', async () => {
    const res = await request(app)
      .post('/api/auth/2fa/disable')
      .set('Authorization', `Bearer ${accessToken}`)
    expect(res.status).toBe(200)
    expect(res.body.enabled).toBe(false)
  })

  it('GET /2fa/status → enabled: false após disable', async () => {
    const res = await request(app)
      .get('/api/auth/2fa/status')
      .set('Authorization', `Bearer ${accessToken}`)
    expect(res.status).toBe(200)
    expect(res.body.enabled).toBe(false)
  })
})
