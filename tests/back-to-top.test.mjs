import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('back-to-top is globally mounted with accessible scroll behavior', async () => {
  const component = await readFile(new URL('../app/components/back-to-top.tsx', import.meta.url), 'utf8');
  const layout = await readFile(new URL('../app/layout.tsx', import.meta.url), 'utf8');

  assert.match(component, /aria-label="Về đầu trang"/);
  assert.match(component, /scrollY > 400/);
  assert.match(component, /prefers-reduced-motion/);
  assert.match(component, /scrollTo\(\{ top: 0,/);
  assert.match(layout, /<BackToTop\s*\/\>/);
});
