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
  assert.deepEqual(validateContact({
    name: 'Nguyễn An',
    contact: 'an@example.com',
    message: 'Mình cần tư vấn sản phẩm.',
  }), {});
});
