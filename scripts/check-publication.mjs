import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicationTarget } from '../src/lib/publication-context.ts';
import { linkedMailbox, verifyLinkedMailbox } from '../src/lib/bot-mailbox.ts';

test('Telegram redirect preserves the selected deal and tag, without accepting redirect destinations', () => {
  const target = new URL(publicationTarget('?dealId=FM123&tag=%23ABC123&next=https://evil.example&password=secret'), 'https://seller.example');
  assert.equal(target.pathname, '/');
  assert.equal(target.searchParams.get('dealId'), 'FM123');
  assert.equal(target.searchParams.get('tag'), '#ABC123');
  assert.equal(target.searchParams.has('next'), false);
  assert.equal(target.searchParams.has('password'), false);
  assert.equal(publicationTarget('?dealId=../../evil&tag=https://evil.example'), '/');
  assert.equal(publicationTarget(''), '/');
});

test('Exact mailbox lookup checks identity and credentials and fails closed before publication', async () => {
  const originalFetch = globalThis.fetch, previous = { ...process.env };
  process.env.BOT_NOTIFY_URL = 'https://bot.example/api/notify';
  process.env.BOT_NOTIFY_KEY = 'server-secret';
  const request = new Request('https://seller.example/api/upload', { headers: { 'x-caller': 'tg:123' } });
  const box = { found: true, dealId: 'FM123', address: 'box@example.com', password: 'mail-secret', label: '#ABC123' };
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url.pathname, '/api/mailbox');
      assert.equal(init.headers['x-api-key'], 'server-secret');
      assert.equal(init.redirect, 'error');
      const body = JSON.parse(init.body);
      assert.equal(body.chatId, 123); assert.equal(body.dealId, 'FM123'); assert.equal(body.game, 'bs'); assert.equal(body.tag, '#ABC123');
      return Response.json(box);
    };
    assert.equal((await linkedMailbox(request, 'FM123', 'bs', '#ABC123')).address, box.address);
    await verifyLinkedMailbox(request, 'FM123', 'bs', { email: 'BOX@example.com', emailPassword: 'mail-secret' }, '#ABC123');
    await assert.rejects(verifyLinkedMailbox(request, 'FM123', 'bs', { email: 'wrong@example.com', emailPassword: 'mail-secret' }, '#ABC123'));
    await assert.rejects(verifyLinkedMailbox(request, 'FM123', 'bs', { email: box.address, emailPassword: 'wrong-secret' }, '#ABC123'));
    globalThis.fetch = async () => Response.json({ found: false });
    await assert.rejects(linkedMailbox(request, 'FM123', 'fn'));
    globalThis.fetch = async () => Response.json({ ...box, dealId: 'OTHER' });
    await assert.rejects(linkedMailbox(request, 'FM123', 'fn'));
    globalThis.fetch = async () => new Response('private provider error', { status: 409 });
    await assert.rejects(linkedMailbox(request, 'FM123', 'fn'), error => !error.message.includes('private provider'));
    let calls = 0; globalThis.fetch = async () => { calls++; return Response.json(box); };
    await assert.rejects(linkedMailbox(new Request('https://seller.example'), 'FM123', 'bs'));
    await assert.rejects(linkedMailbox(request, '../invalid', 'bs'));
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
});
