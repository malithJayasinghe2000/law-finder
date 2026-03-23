import { config } from 'dotenv';
import path from 'path';
import { defineConfig } from 'prisma/config';

// Load .env relative to this file's directory
config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'ts-node --compiler-options {"module":"CommonJS"} ./prisma/seed.ts'
  },
  datasource: {
    url: process.env.DATABASE_URL
  }
});
