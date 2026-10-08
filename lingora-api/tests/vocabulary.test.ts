import { expect, test } from 'bun:test';
test('vocabulary lifecycle, authorization and concurrent edits against the configured database', () => {
  const result = Bun.spawnSync([process.execPath, 'test', './tests/vocabulary.check.ts'], { cwd: new URL('..', import.meta.url).pathname });
  if (result.exitCode !== 0) console.error(result.stderr.toString());
  expect(result.exitCode).toBe(0);
}, 60000);
