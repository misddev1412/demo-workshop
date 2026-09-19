# Contact Form UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an accessible, responsive contact form with client-side validation and a clearly simulated success state, without network or Supabase integration.

**Architecture:** Keep validation in a small pure TypeScript module so it can be tested with the repository's Node test runner. Render a dedicated Client Component from the existing client-rendered home page and style it through the established global stylesheet.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS, Node test runner.

---

### Task 1: Contact validation

**Files:**
- Create: `lib/contact.ts`
- Create: `tests/contact.test.mjs`

- [x] **Step 1: Write the failing validation tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateContact } from '../lib/contact.ts';

test('requires every contact field', () => {
  assert.deepEqual(validateContact({ name: '', contact: '', message: '' }), {
    name: 'Vui lòng nhập họ và tên.',
    contact: 'Vui lòng nhập email hoặc số điện thoại.',
    message: 'Vui lòng nhập lời nhắn.',
  });
});

test('accepts a complete contact message', () => {
  assert.deepEqual(validateContact({ name: 'Nguyễn An', contact: 'an@example.com', message: 'Mình cần tư vấn sản phẩm.' }), {});
});
```

- [x] **Step 2: Run the focused test and verify RED**

Run: `node --conditions=react-server --experimental-strip-types --test tests/contact.test.mjs`
Expected: FAIL because `lib/contact.ts` does not exist.

- [x] **Step 3: Implement the pure validator**

```ts
export type ContactFields = { name: string; contact: string; message: string };
export type ContactErrors = Partial<Record<keyof ContactFields, string>>;

export function validateContact(fields: ContactFields): ContactErrors {
  const errors: ContactErrors = {};
  if (!fields.name.trim()) errors.name = 'Vui lòng nhập họ và tên.';
  if (!fields.contact.trim()) errors.contact = 'Vui lòng nhập email hoặc số điện thoại.';
  if (!fields.message.trim()) errors.message = 'Vui lòng nhập lời nhắn.';
  return errors;
}
```

- [x] **Step 4: Run the focused test and verify GREEN**

Run: `node --conditions=react-server --experimental-strip-types --test tests/contact.test.mjs`
Expected: 2 passing tests.

### Task 2: Contact form component and placement

**Files:**
- Create: `app/components/contact-form.tsx`
- Modify: `app/page.tsx`

- [x] **Step 1: Create the client component**

Implement `ContactForm` with controlled `name`, `contact`, and `message` fields; call `validateContact` on submit; focus the first invalid field; use `aria-invalid`, `aria-describedby`, and `role="alert"`; simulate submission with a short timer and show wording that does not claim server persistence; provide a reset action.

- [x] **Step 2: Render the component before the footer**

Import `ContactForm` into `app/page.tsx`, render it after the story section, and change the header “Kết nối” link to `#contact`.

- [x] **Step 3: Verify static behavior**

Run: `npm run lint`
Expected: exit 0 with no lint errors.

### Task 3: Responsive visual system

**Files:**
- Modify: `app/globals.css`

- [x] **Step 1: Add desktop styles**

Add a two-column `.contact-section`, restrained editorial copy, underlined input surfaces, visible focus states, inline errors, submit state, and a quiet success panel using the existing green/cream palette.

- [x] **Step 2: Add mobile styles**

At the existing `max-width: 700px` breakpoint, stack the section, reduce spacing and type scale, and keep every control at least 44px tall.

- [x] **Step 3: Respect reduced motion**

Keep all contact transitions covered by the existing `prefers-reduced-motion` override.

### Task 4: Full verification

**Files:**
- Modify: `docs/superpowers/plans/2026-09-19-contact-form-ui.md`

- [x] **Step 1: Run all automated checks**

Run: `npm test && npm run lint && npm run build`
Expected: all tests pass, lint exits 0, and Next.js production build exits 0.

- [x] **Step 2: Inspect the final diff**

Run: `git diff --check && git status --short`
Expected: no whitespace errors; only the planned implementation files plus the user's pre-existing `README.md` change are present.

- [x] **Step 3: Commit the implementation**

```bash
git add app/components/contact-form.tsx app/page.tsx app/globals.css lib/contact.ts tests/contact.test.mjs docs/superpowers/plans/2026-09-19-contact-form-ui.md
git commit -m "feat: add contact form interface"
```
