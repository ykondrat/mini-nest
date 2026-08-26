import 'reflect-metadata';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Controller } from '../src/decorators/controller';
import { Get } from '../src/decorators/methods';
import { Param } from '../src/decorators/params';
import { GreetingService } from '../src/services/greeting.service';
import { startTestServer } from './helpers';

@Controller('ctx')
class CtxController {
  constructor(private readonly greeting: GreetingService) {}

  @Get(':name')
  hello(@Param('name') name: string) {
    const { requestId } = this.greeting.greet(name);

    return { requestId };
  }
}

test('X-Request-Id: a client-supplied id is echoed and reaches a service two levels deep', async () => {
  const server = await startTestServer([CtxController]);

  try {
    const res = await fetch(`${server.url}/ctx/ada`, { headers: { 'x-request-id': 'client-123' } });

    assert.equal(res.headers.get('x-request-id'), 'client-123');

    const body = (await res.json()) as { requestId: string };

    assert.equal(body.requestId, 'client-123');
  } finally {
    await server.close();
  }
});

test('X-Request-Id: a fresh id is generated when the client sends none', async () => {
  const server = await startTestServer([CtxController]);

  try {
    const res = await fetch(`${server.url}/ctx/ada`);

    const header = res.headers.get('x-request-id');

    assert.ok(header && header.length > 0);

    const body = (await res.json()) as { requestId: string };

    assert.equal(body.requestId, header);
  } finally {
    await server.close();
  }
});

test('10 concurrent requests never mix request-ids', async () => {
  const server = await startTestServer([CtxController]);

  try {
    const ids = Array.from({ length: 10 }, (_, i) => `req-${i}`);

    const results = await Promise.all(
      ids.map(async (id) => {
        const res = await fetch(`${server.url}/ctx/user`, { headers: { 'x-request-id': id } });
        const header = res.headers.get('x-request-id');
        const body = (await res.json()) as { requestId: string };

        return { id, header, deep: body.requestId };
      }),
    );

    for (const r of results) {
      assert.equal(r.header, r.id, `response header leaked: ${r.header} != ${r.id}`);
      assert.equal(r.deep, r.id, `deep read leaked: ${r.deep} != ${r.id}`);
    }
  } finally {
    await server.close();
  }
});