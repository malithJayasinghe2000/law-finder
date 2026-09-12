const { Client } = require('pg');
(async () => {
  const name = process.argv[2];
  const c = new Client('postgresql://postgres:root@localhost:5432/postgres');
  await c.connect();
  await c.query(`DROP DATABASE IF EXISTS "${name}"`);
  await c.query(`CREATE DATABASE "${name}"`);
  await c.end();
  console.log('created', name);
})().catch(e => { console.error(e.message); process.exit(1); });
