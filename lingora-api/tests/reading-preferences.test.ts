import { expect, test } from 'bun:test';

test('reading preference routes enforce defaults, authorization and account isolation', () => {
  // Run module mocks in a child process so they cannot affect the real database tests.
  const result = Bun.spawnSync([process.execPath, 'test', './tests/reading-preferences.check.ts'], {
    cwd: new URL('..', import.meta.url).pathname,
  });
  if (result.exitCode !== 0) console.error(result.stderr.toString());
  expect(result.exitCode).toBe(0);
});
