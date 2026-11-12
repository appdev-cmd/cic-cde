import assert from 'node:assert/strict';
import { documentRevision } from '../apps/desktop/src/documentVersion.ts';

for (const revision of [1, 2, 9, 10, 99, 100, 1000]) {
  const legacy = { revision, revisionCode: null };
  assert.equal(documentRevision(legacy), 'R' + String(revision).padStart(2, '0'));
  assert.equal(documentRevision({ ...legacy, revisionCode: 'P03.02' }), 'P03.02');
  assert.equal(legacy.revisionCode, null);
}
console.log('Legacy Rxx and explicit BEP revision display preserved');
