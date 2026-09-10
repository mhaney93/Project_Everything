// One-time migration: copy the legacy on-disk uploads (pulled off EC2) into
// Vercel Blob and rewrite files.file_path / files.filename in Neon.
//
// Usage:
//   1. On EC2:  docker compose -f docker-compose.prod.yml cp api:/app/uploads ./_ec2_uploads
//   2. Locally: scp -r project-everything:~/project_everything/_ec2_uploads ./_ec2_uploads
//   3. Locally: DATABASE_URL=... BLOB_READ_WRITE_TOKEN=... node scripts/migrate-files-to-blob.mjs ./_ec2_uploads
//
// Safe to re-run: rows whose file_path is already an https URL are skipped.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { put } from '@vercel/blob';
import pkg from 'pg';

const { Pool } = pkg;

const UPLOADS_DIR = process.argv[2] || './_ec2_uploads';

if (!process.env.DATABASE_URL || !process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('Set DATABASE_URL and BLOB_READ_WRITE_TOKEN in the environment.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const { rows } = await pool.query(
  'SELECT id, filename, original_filename, file_type, file_path FROM files ORDER BY id'
);
console.log(`${rows.length} file rows in DB\n`);

let migrated = 0;
let skipped = 0;
let missing = 0;

for (const row of rows) {
  if (row.file_path && /^https?:\/\//i.test(row.file_path)) {
    console.log(`#${row.id}  already migrated`);
    skipped++;
    continue;
  }

  const local = path.join(UPLOADS_DIR, row.filename);
  let buf;
  try {
    buf = await readFile(local);
  } catch {
    console.warn(`#${row.id}  MISSING local file: ${row.filename}`);
    missing++;
    continue;
  }

  const blob = await put(row.filename, buf, {
    access: 'public',
    contentType: row.file_type || 'application/octet-stream',
    addRandomSuffix: true,
  });

  await pool.query(
    'UPDATE files SET file_path = $1, filename = $2 WHERE id = $3',
    [blob.url, blob.pathname, row.id]
  );
  console.log(`#${row.id}  ${row.original_filename}  ->  ${blob.url}`);
  migrated++;
}

console.log(`\nDone. migrated=${migrated} skipped=${skipped} missing=${missing}`);
await pool.end();
