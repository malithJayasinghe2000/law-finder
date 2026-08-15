/**
 * Backfill: encrypt privileged matter data that is still stored in plaintext.
 *
 * Run with: npm run privacy:encrypt
 *           npm run privacy:encrypt -- --dry-run
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why this is a script and not a SQL migration.
 *
 * The encryption key lives in the application's environment, not in the
 * database. A migration runs inside the database and cannot reach it — and
 * putting key material into a migration file would commit the key to the
 * repository, which is the opposite of the point. So the schema migration adds
 * nothing (the columns are already `String`), and the data moves here.
 *
 * It is idempotent: a value that is already in the envelope form is skipped, so
 * running it twice does nothing the second time. That matters because the safe
 * way to use it on a real database is to run it, check, and run it again.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import prisma from '../src/lib/db';
import {
  ENCRYPTED_FIELDS,
  encryptField,
  encryptFieldList,
  isEncrypted,
  encryptionIsConfigured,
} from '../src/lib/privacy/encryption';

const DRY_RUN = process.argv.includes('--dry-run');

type Counts = { scanned: number; encrypted: number; alreadyDone: number };

async function main() {
  if (!encryptionIsConfigured()) {
    console.error(
      '\nMATTER_ENCRYPTION_KEYS is not set, so there is nothing to encrypt with.\n' +
        'Generate a key:\n' +
        '  node -e "console.log(\'k1:\' + require(\'crypto\').randomBytes(32).toString(\'base64\'))"\n' +
        'and add it to .env as MATTER_ENCRYPTION_KEYS.\n'
    );
    process.exit(1);
  }

  console.log(
    `\nEncrypting privileged matter data${DRY_RUN ? ' (DRY RUN — nothing is written)' : ''}\n`
  );

  const totals: Counts = { scanned: 0, encrypted: 0, alreadyDone: 0 };

  for (const spec of ENCRYPTED_FIELDS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = (prisma as any)[spec.prismaModel];
    const columns = [spec.idField, ...spec.scalar, ...spec.list];

    const rows: Record<string, unknown>[] = await model.findMany({
      select: Object.fromEntries(columns.map((c) => [c, true])),
    });

    const counts: Counts = { scanned: rows.length, encrypted: 0, alreadyDone: 0 };

    for (const row of rows) {
      const recordId = row[spec.idField] as string;
      const data: Record<string, unknown> = {};

      for (const field of spec.scalar) {
        const value = row[field] as string | null;
        if (value === null || value === undefined || value === '') continue;
        if (isEncrypted(value)) {
          counts.alreadyDone++;
          continue;
        }
        data[field] = encryptField({ model: spec.model, recordId, field }, value);
      }

      for (const field of spec.list) {
        const values = (row[field] as string[] | null) ?? [];
        if (values.length === 0) continue;
        // A list is all-or-nothing: element indexes are part of the binding, so
        // half-encrypting one would make the remaining elements undecryptable
        // at the wrong index.
        if (values.every(isEncrypted)) {
          counts.alreadyDone++;
          continue;
        }
        if (values.some(isEncrypted)) {
          throw new Error(
            `${spec.model}.${field} on ${recordId} is partly encrypted. That should be ` +
              `impossible — element indexes are part of the binding, so a mixed list ` +
              `cannot be repaired automatically. Investigate before rerunning.`
          );
        }
        data[field] = encryptFieldList({ model: spec.model, recordId, field }, values);
      }

      if (Object.keys(data).length === 0) continue;

      counts.encrypted++;
      if (!DRY_RUN) {
        await model.update({ where: { [spec.idField]: recordId }, data });
      }
    }

    console.log(
      `  ${spec.model.padEnd(18)} ${String(counts.scanned).padStart(5)} rows · ` +
        `${counts.encrypted} encrypted · ${counts.alreadyDone} already done`
    );

    totals.scanned += counts.scanned;
    totals.encrypted += counts.encrypted;
    totals.alreadyDone += counts.alreadyDone;
  }

  console.log(
    `\n${totals.encrypted} rows encrypted, ${totals.alreadyDone} already encrypted, ` +
      `${totals.scanned} scanned.${DRY_RUN ? ' Nothing was written.' : ''}\n`
  );

  if (!DRY_RUN && totals.encrypted > 0) {
    console.log(
      'Now run `npm run check:privilege` — it asserts that no plaintext remains\n' +
        'in any of these columns, which is the only way to know this finished.\n'
    );
  }
}

main()
  .catch((error) => {
    console.error('\nBackfill failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
