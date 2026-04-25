import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const ADMIN_ID = 'admin-i9-fixo-0000-0000-000000000001'

async function main() {
  console.log('Iniciando seed...')

  const senha = await bcrypt.hash('i9admin2024', 10)

  await prisma.user.upsert({
    where: { id: ADMIN_ID },
    update: {},
    create: {
      id: ADMIN_ID,
      name: 'Fabiano Admin',
      email: 'admin@i9solucoes.com.br',
      passwordHash: senha,
      role: 'ADMIN',
    },
  })

  console.log('Usuário admin garantido com sucesso!')
  console.log('Email: admin@i9solucoes.com.br')
  console.log('Senha: i9admin2024')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })