const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

console.log("Exposed models on PrismaClient:", Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$')));

prisma.$disconnect();
pool.end();
