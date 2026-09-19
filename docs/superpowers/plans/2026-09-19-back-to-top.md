# Back to Top Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an accessible floating control that appears after scrolling and returns the storefront to the top.

**Architecture:** A small Client Component owns the browser scroll listener and click behavior. The Server Component root layout mounts it globally, while global CSS handles visual states, responsive spacing, focus, and reduced motion.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS, Node test runner

---

### Task 1: Back-to-top behavior contract

**Files:**
- Create: `tests/back-to-top.test.mjs`

- [x] **Step 1: Write the failing source contract test**

```js
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
```

- [x] **Step 2: Run the test and verify RED**

Run: `node --test tests/back-to-top.test.mjs`

Expected: FAIL because `app/components/back-to-top.tsx` does not exist.

### Task 2: Implement the focused Client Component

**Files:**
- Create: `app/components/back-to-top.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

- [x] **Step 1: Implement the component**

Create a Client Component with `visible` state, a passive `scroll` listener that evaluates `window.scrollY > 400`, cleanup on unmount, and a click handler that calls:

```ts
window.scrollTo({
  top: 0,
  behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
});
```

Render a `button` with `type="button"`, `aria-label="Về đầu trang"`, the class names `back-to-top` and conditional `is-visible`, and an `aria-hidden` upward SVG arrow.

- [x] **Step 2: Mount globally**

Import `BackToTop` in `app/layout.tsx`, then render `<BackToTop />` after `{children}` inside `<body>`.

- [x] **Step 3: Add restrained responsive styles**

Add fixed bottom-right positioning, a 48-pixel circular green control, hidden opacity/translation/pointer state by default, `.is-visible` reveal state, hover lift, shadow, `z-index: 4`, and a 44-pixel mobile size with 16-pixel offsets. Keep the existing global focus-visible rule.

- [x] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/back-to-top.test.mjs`

Expected: PASS.

### Task 3: Verify and deliver

**Files:**
- Modify: `docs/superpowers/plans/2026-09-19-back-to-top.md` (check completed steps)

- [x] **Step 1: Run automated verification**

Run: `npm test && npm run lint && npm run build`

Expected: all tests pass, ESLint exits successfully, and Next.js production build completes.

- [x] **Step 2: Verify in a browser**

Start `npm run dev`, verify the button is hidden at the top, appears after scrolling beyond 400 pixels, returns the page to scroll position 0, and remains usable at desktop and mobile widths.

- [x] **Step 3: Review the diff**

Run: `git diff --check && git diff -- app/components/back-to-top.tsx app/layout.tsx app/globals.css tests/back-to-top.test.mjs`

Expected: no whitespace errors and only scoped feature changes. Do not stage `README.md`.

- [x] **Step 4: Commit and push**

```bash
git add app/components/back-to-top.tsx app/layout.tsx app/globals.css tests/back-to-top.test.mjs docs/superpowers/plans/2026-09-19-back-to-top.md
git commit -m "feat: add back to top control"
git push origin main
```
