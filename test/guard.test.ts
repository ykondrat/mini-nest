import 'reflect-metadata';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Controller } from '../src/decorators/controller';
import { Get } from '../src/decorators/methods';
import { AuthGuard } from '../src/guards/auth.guard';
import { startTestServer } from './helpers';

let handlerCalls = 0;

@Controller('secure')
class SecureController {
  @Get()
  read() {
    handlerCalls += 1;
    return { ok: true };
  }
}

test('no Authorization → 403 and the handler never runs', async () => {
  handlerCalls = 0;
  const server = await startTestServer([SecureController], [], { guards: [AuthGuard] });

  try {
    const res = await fetch(`${server.url}/secure`);

    assert.equal(res.status, 403);
    assert.equal(handlerCalls, 0);
  } finally {
    await server.close();
  }
});

test('with Authorization → 200 and the handler runs once', async () => {
  handlerCalls = 0;
  const server = await startTestServer([SecureController], [], { guards: [AuthGuard] });

  try {
    const res = await fetch(`${server.url}/secure`, { headers: { authorization: 'Bearer token' } });

    assert.equal(res.status, 200);
    assert.equal(handlerCalls, 1);
  } finally {
    await server.close();
  }
});