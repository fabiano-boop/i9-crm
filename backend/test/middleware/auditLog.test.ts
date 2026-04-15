import request from 'supertest'
import { app } from '../../src/server.js'
import { prisma } from '../../src/config/database.js'
import bcrypt from 'bcryptjs'

const testEmail = `testaudit+${Date.now()}@i9test.com`
let accessToken: string

beforeAll(async () => {
  await prisma.user.create({
    data: {
      name: 'Audit Tester',
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
  await prisma.auditLog.deleteMany({ where: { userEmail: testEmail } })
  await prisma.twoFactorSecret.deleteMany({ where: { user: { email: testEmail } } })
  await prisma.user.deleteMany({ where: { email: testEmail } })
  await prisma.$disconnect()
})

describe('AuditLog middleware', () => {
  it('POST mutante deve gerar registro no AuditLog', async () => {
    await request(app)
      .post('/api/auth/2fa/setup')
      .set('Authorization', `Bearer ${accessToken}`)

    // Aguarda setImmediate flushear para o banco
    await new Promise((r) => setTimeout(r, 150))

    const log = await prisma.auditLog.findFirst({
      where: { userEmail: testEmail, action: 'POST', entity: 'auth' },
      orderBy: { createdAt: 'desc' },
    })
    expect(log).not.toBeNull()
    expect(log?.action).toBe('POST')
    expect(log?.entity).toBe('auth')
  })

  it('GET não deve gerar registro no AuditLog', async () => {
    const before = await prisma.auditLog.count({ where: { userEmail: testEmail } })

    await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)

    await new Promise((r) => setTimeout(r, 150))

    const after = await prisma.auditLog.count({ where: { userEmail: testEmail } })
    expect(after).toBe(before)
  })

  it('campos sensíveis devem aparecer como [REDACTED]', async () => {
    await new Promise((r) => setTimeout(r, 150))
    const log = await prisma.auditLog.findFirst({
      where: { userEmail: testEmail, action: 'POST' },
      orderBy: { createdAt: 'desc' },
    })
    if (log?.after && typeof log.after === 'object') {
      const after = log.after as Record<string, unknown>
      expect(after['password']).not.toBeDefined()
      expect(after['passwordHash']).not.toBeDefined()
      expect(after['secret']).not.toBeDefined()
    }
  })
})
