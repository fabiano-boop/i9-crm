import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Iniciando seed...')

  const senha = await bcrypt.hash('admin123', 10)

  await prisma.user.deleteMany({
    where: { email: 'admin@i9solucoes.com.br' }
  })

  await prisma.user.create({
    data: {
      id: 'user_admin_01',
      name: 'Admin i9',
      email: 'admin@i9solucoes.com.br',
      passwordHash: senha,
      role: 'ADMIN',
    }
  })

  console.log('Usuário admin criado com sucesso!')
  console.log('Email: admin@i9solucoes.com.br')
  console.log('Senha: admin123')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })