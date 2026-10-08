import 'dotenv/config';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { db, pool } from './index';
import { vocabularyPages } from './schema';

// Data migration only: the existing schema already stores image URLs.
// Immutable content-addressed paths make retries safe without overwriting images.
const root = resolve(import.meta.dir, '../../..');
const source = existsSync(resolve(root, 'docs/vocabulary-assets'))
  ? resolve(root, 'docs/vocabulary-assets') : resolve(root, 'lingora-web/public/assets/vocab');
const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
const key = process.env.SUPABASE_SECRET_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'lesson-media';
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
type Asset = { localUrl: string; sourcePath: string; storagePath: string; url: string; sha256: string; bytes: number };

async function migrate() {
  if (!base || !key) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required.');
  const headers = { apikey: key };
  const bucketResponse = await fetch(`${base}/storage/v1/bucket/${encodeURIComponent(bucket)}`, { headers });
  if (!bucketResponse.ok || !(await bucketResponse.json()).public) throw new Error('Configured storage bucket must exist and be public.');
  const names = readdirSync(source).filter(name => /^[a-z0-9-]+\.png$/.test(name)).sort();
  if (!names.length) throw new Error('No vocabulary source images found.');
  const assets: Asset[] = [];
  // Bound upload concurrency to keep memory usage small for the large backgrounds.
  let cursor = 0;
  const uploads = await Promise.allSettled(Array.from({ length: 4 }, async () => {
    while (cursor < names.length) {
      const name = names[cursor++];
      const bytes = new Uint8Array(await Bun.file(resolve(source, name)).arrayBuffer());
      const sha256 = hash(bytes);
      const storagePath = `vocabulary/${sha256.slice(0, 20)}-${name}`;
      const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/');
      const configuredBase = process.env.SUPABASE_STORAGE_PUBLIC_URL?.replace(/\/$/, '');
      const url = configuredBase ? `${configuredBase}/${encodedPath}` : `${base}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedPath}`;
      const head = await fetch(url, { method: 'HEAD' });
      if (!head.ok) {
        if (head.status !== 400 && head.status !== 404) throw new Error(`Storage check failed for ${name}: ${head.status}`);
        const uploaded = await fetch(`${base}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`, {
          method: 'POST', headers: { ...headers, 'Content-Type': 'image/png', 'x-upsert': 'false', 'Cache-Control': 'max-age=31536000' }, body: bytes,
        });
        if (!uploaded.ok && uploaded.status !== 409) throw new Error(`Upload failed for ${name}: ${uploaded.status}`);
      }
      const verified = await fetch(url);
      if (!verified.ok || hash(new Uint8Array(await verified.arrayBuffer())) !== sha256) throw new Error(`Public image checksum mismatch: ${name}`);
      assets.push({ localUrl: `/assets/vocab/${name}`, sourcePath: `docs/vocabulary-assets/${name}`, storagePath, url, sha256, bytes: bytes.length });
      console.log(`Verified ${assets.length}/${names.length}: ${name}`);
    }
  }));
  const failed = uploads.find(result => result.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
  assets.sort((a, b) => a.localUrl.localeCompare(b.localUrl));
  const urls = new Map(assets.map(asset => [asset.localUrl, asset.url]));
  const replace = (url: string) => urls.get(url) ?? url;
  let changed = 0;
  await db.transaction(async tx => {
    const pages = await tx.select().from(vocabularyPages).for('update');
    for (const page of pages) {
      const backgroundUrl = replace(page.backgroundUrl);
      const items = page.items.map(item => ({ ...item, imageUrl: replace(item.imageUrl) }));
      if (backgroundUrl === page.backgroundUrl && items.every((item, i) => item.imageUrl === page.items[i].imageUrl)) continue;
      await tx.update(vocabularyPages).set({ backgroundUrl, items, revision: page.revision + 1, updatedAt: new Date() }).where(eq(vocabularyPages.id, page.id));
      changed++;
    }
  });
  const definitionsPath = resolve(root, 'docs/vocabulary-pages.json');
  const definitions = await Bun.file(definitionsPath).json() as Array<{ backgroundUrl: string; items: Array<{ imageUrl: string }> }>;
  for (const page of definitions) {
    page.backgroundUrl = replace(page.backgroundUrl);
    page.items = page.items.map(item => ({ ...item, imageUrl: replace(item.imageUrl) }));
  }
  await Bun.write(definitionsPath, `${JSON.stringify(definitions, null, 2)}\n`);
  await Bun.write(resolve(root, 'docs/vocabulary-storage.json'), `${JSON.stringify({ bucket, assets }, null, 2)}\n`);
  console.log(`Vocabulary storage migration: ${assets.length} images verified, ${changed} pages updated. Custom URLs and all other page fields preserved.`);
}

try { await migrate(); } finally { await pool.end(); }
