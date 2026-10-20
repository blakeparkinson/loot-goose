// deno test supabase/functions/_shared/shareableHunt.test.ts
import assert from 'node:assert/strict';
import { toShareableHunt } from './shareableHunt.ts';

const playedHunt = {
  id: 'hunt-1',
  title: 'Park Loop',
  location: 'Fremont, Seattle',
  coords: { latitude: 47.651234, longitude: -122.350987 },
  prompt: 'statues',
  difficulty: 'easy',
  totalPoints: 30,
  earnedPoints: 30,
  createdAt: '2026-10-01T00:00:00Z',
  startedAt: '2026-10-01T01:00:00Z',
  completedAt: '2026-10-01T02:00:00Z',
  publishedCode: 'ABC123',
  somethingNew: 'not on the list',
  items: [
    {
      id: 'item-1',
      name: 'Troll',
      description: 'Under the bridge',
      points: 30,
      completed: true,
      sublocation: 'Aurora Bridge',
      coords: { latitude: 47.651, longitude: -122.347 },
      photoUri: 'file:///var/mobile/photo.jpg',
      verificationNote: 'Nice shot of you and the troll!',
      completedAt: '2026-10-01T01:30:00Z',
    },
  ],
};

Deno.test('drops photos, notes, timings and the hunt centre point', () => {
  const out = toShareableHunt(playedHunt)!;
  for (const key of ['coords', 'startedAt', 'completedAt', 'publishedCode', 'somethingNew']) {
    assert.equal(key in out, false, key);
  }
  const [item] = out.items;
  for (const key of ['photoUri', 'verificationNote', 'completedAt']) {
    assert.equal(key in item, false, key);
  }
});

Deno.test('keeps the place name and the stops, including stop coordinates', () => {
  const out = toShareableHunt(playedHunt)!;
  assert.equal(out.location, 'Fremont, Seattle');
  assert.equal(out.title, 'Park Loop');
  assert.deepEqual(out.items[0].coords, { latitude: 47.651, longitude: -122.347 });
  assert.equal(out.items[0].name, 'Troll');
  assert.equal(out.items[0].sublocation, 'Aurora Bridge');
});

Deno.test('rejects payloads that are not hunt objects', () => {
  for (const input of [null, undefined, 'hunt', 42, [playedHunt]]) {
    assert.equal(toShareableHunt(input), null);
  }
});

Deno.test('tolerates missing or malformed items', () => {
  assert.deepEqual(toShareableHunt({}), { items: [] });
  assert.deepEqual(toShareableHunt({ items: 'nope' }), { items: [] });
  const out = toShareableHunt({ items: [null, 'x', { id: 'a', coords: { latitude: '1', longitude: 2 } }] })!;
  assert.deepEqual(out.items, [{ id: 'a' }]);
});

Deno.test('is idempotent', () => {
  const once = toShareableHunt(playedHunt);
  assert.deepEqual(toShareableHunt(once), once);
});
