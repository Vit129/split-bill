import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeSignal, encodeSignal } from '../src/logic/share-code.ts';

test('[BE-UT] invite code round-trips the session description', () => {
  const desc = { type: 'offer' as const, sdp: 'v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\n' };
  assert.deepEqual(decodeSignal(encodeSignal(desc)), desc);
});

test('[BE-UT] rejects text that is not a valid code', () => {
  const invalid = ['', '   ', 'not base64!!', btoa('{"v":1}'), btoa(JSON.stringify({ v: 2, type: 'offer', sdp: 'x' })),
    btoa(JSON.stringify({ v: 1, type: 'hacked', sdp: 'x' })), 'a'.repeat(30000)];
  for (const code of invalid) {
    assert.throws(() => decodeSignal(code), /INVALID_CODE/, `should reject: ${code.slice(0, 20)}`);
  }
});
