const { Client } = require('pg');
let pass = 0; const fails = [];
const ok = (n, c, why) => c ? (pass++, console.log('  PASS ', n)) : (fails.push(`  FAIL  ${n}\n        ${why}`), console.log('  FAIL ', n));
(async () => {
  const c = new Client(process.env.DATABASE_URL);
  await c.connect();
  const n = (await c.query(`SELECT * FROM "PrivacyNotice"`)).rows;
  ok('exactly one notice version exists', n.length === 1, `found ${n.length}`);
  const v = n[0];
  ok('it is version 2026-08-03', v.version === '2026-08-03', `got ${v && v.version}`);
  ok('it is PUBLISHED', v.status === 'PUBLISHED', `got ${v && v.status}`);
  ok('it has a publishedAt', !!v.publishedAt, 'a published notice with no date is not evidence of anything');
  ok('the body survived the dollar-quoting intact', v.body.includes('# Privacy Notice') && v.body.includes('## 12. Changes to this notice'), `body is ${v.body.length} chars`);
  ok('the body kept its em dashes and non-ASCII', v.body.includes('—'), 'encoding was mangled on the way in');
  ok('the change summary is honest about when it was written', /written when the version register was built/.test(v.changeSummary || ''), 'a backdated document with no note is a dishonest register');

  const unresolved = (await c.query(
    `SELECT cr."noticeVersion", count(*) FROM "ConsentRecord" cr
     LEFT JOIN "PrivacyNotice" pn ON pn.version = cr."noticeVersion"
     WHERE pn.id IS NULL GROUP BY 1`
  )).rows;
  ok('EVERY pre-existing consent record now resolves to a document',
     unresolved.length === 0,
     `still dangling: ${JSON.stringify(unresolved)} — this is the exact defect the migration exists to repair`);

  const cnt = (await c.query(`SELECT count(*)::int AS n FROM "ConsentRecord"`)).rows[0].n;
  ok('the consent records themselves were not touched', cnt === 2, `expected 2, got ${cnt}`);

  await c.end();
  if (fails.length) { console.error('\n' + fails.join('\n\n')); console.error(`\n${pass} passed, ${fails.length} FAILED\n`); process.exit(1); }
  console.log(`\n${pass} passed, 0 failed\n`);
})().catch(e => { console.error(e); process.exit(1); });
