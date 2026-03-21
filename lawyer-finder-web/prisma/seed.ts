import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import * as bcrypt from 'bcryptjs'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
// @ts-ignore
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10)

  // 1. Create Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@lawfinder.lk' },
    update: {},
    create: {
      email: 'admin@lawfinder.lk',
      passwordHash,
      role: 'ADMIN',
    },
  })

  // 2. Create Lawyer
  const lawyer = await prisma.user.upsert({
    where: { email: 'lawyer@lawfinder.lk' },
    update: {},
    create: {
      email: 'lawyer@lawfinder.lk',
      passwordHash,
      role: 'LAWYER',
      profile: {
        create: {
          fullName: 'Test Lawyer',
          baslNumber: 'BASL-TEST-123',
          isVerified: true,
          practiceAreas: ['Family Law', 'Property Law'],
          languages: ['Sinhala', 'English'],
          district: 'Colombo'
        }
      }
    },
  })

  // 3. Create Client
  const client = await prisma.user.upsert({
    where: { email: 'citizen@lawfinder.lk' },
    update: {},
    create: {
      email: 'citizen@lawfinder.lk',
      passwordHash,
      role: 'CLIENT',
    },
  })

  console.log('-------------------------------------------')
  console.log('✅ Database seeded perfectly!')
  console.log('Login Credentials (Password for all: password123):')
  console.log(`Admin:  ${admin.email}`)
  console.log(`Lawyer: ${lawyer.email}`)
  console.log(`Client: ${client.email}`)
  console.log('-------------------------------------------')
}

main()
  .then(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    await pool.end()
    process.exit(1)
  })
