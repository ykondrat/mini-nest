import 'reflect-metadata';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Controller } from '../src/decorators/controller';
import { Get } from '../src/decorators/methods';
import { Param } from '../src/decorators/params';
import { startTestServer } from './helpers';

@Controller('users')
class UsersController {
  @Get(':id')
  findOne(@Param('id') id: string) {
    return { kind: 'dynamic', id };
  }

  @Get('me')
  me() {
    return { kind: 'static' };
  }
}

test('static segment wins over :param regardless of declaration order', async () => {
  const server = await startTestServer([UsersController]);

  try {
    const me = await fetch(`${server.url}/users/me`);

    assert.equal(me.status, 200);
    assert.deepEqual(await me.json(), { kind: 'static' });

    const byId = await fetch(`${server.url}/users/42`);

    assert.equal(byId.status, 200);
    assert.deepEqual(await byId.json(), { kind: 'dynamic', id: '42' });
  } finally {
    await server.close();
  }
});