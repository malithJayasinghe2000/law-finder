// Rows that must survive the migration: consent records pointing at version
// '2026-08-03', the exact state this migration exists to repair.
const { Client } = require('pg');
(async () => {
  const c = new Client(process.env.DATABASE_URL);
  await c.connect();
  const u = await c.query(
    `INSERT INTO "User" (id, email, "fullName", role) VALUES (gen_random_uuid(), 'consenter@example.com', 'Old Consenter', 'CLIENT') RETURNING id`
  );
  const uid = u.rows[0].id;
  await c.query(
    `INSERT INTO "ConsentRecord" (id, "userId", purpose, "noticeVersion") VALUES
      (gen_random_uuid(), $1, 'MARKETING_EMAIL', '2026-08-03'),
      (gen_random_uuid(), $1, 'AI_HISTORY_RETENTION', '2026-08-03')`,
    [uid]
  );
  console.log('seeded 2 consent records at noticeVersion 2026-08-03 for', uid);
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
