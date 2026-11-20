import assert from 'node:assert/strict';
import test from 'node:test';
import { readAllPages } from '../src/lib/pagination.ts';

test('keeps reading when the service caps responses below the requested range', async () => {
  const records = [1, 2, 3, 4, 5];
  const offsets = [];
  const result = await readAllPages(async (from, to) => {
    offsets.push(from);
    return { data: records.slice(from, Math.min(to + 1, from + 2)), error: null };
  });

  assert.deepEqual(result, records);
  assert.deepEqual(offsets, [0, 2, 4, 5]);
});

test('propagates a later request error instead of returning partial totals', async () => {
  const error = new Error('Request failed');
  await assert.rejects(
    readAllPages(async (from) => from === 0
      ? { data: [1], error: null }
      : { data: null, error }),
    (failure) => failure === error,
  );
});
