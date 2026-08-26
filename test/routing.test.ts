import 'reflect-metadata';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Controller } from '../src/decorators/controller';
import { Get } from '../src/decorators/methods';
import { Param, Query } from '../src/decorators/params';
import { Injectable } from '../src/decorators/injectable';
import { startTestServer } from './helpers';

@Injectable()
class UsersService {
  find(id: number) {
    return { id, name: `user-${id}` };
  }
}

@Controller('users')
class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.users.find(Number(id));
  }

  @Get()
  list(@Query('limit') limit: string) {
    return { limit: Number(limit), items: [] as unknown[] };
  }
}

test('prefix join + @Param: GET /users/42 hits the route and returns 42', async () => {
  const server = await startTestServer([UsersController], [UsersService]);

  try {
    const res = await fetch(`${server.url}/users/42`);

    assert.equal(res.status, 200);

    const body = (await res.json()) as { id: number; name: string };

    assert.equal(body.id, 42);
    assert.equal(body.name, 'user-42');
  } finally {
    await server.close();
  }
});

test('@Query: GET /users?limit=5 delivers 5 to the handler as an argument', async () => {
  const server = await startTestServer([UsersController], [UsersService]);

  try {
    const res = await fetch(`${server.url}/users?limit=5`);

    assert.equal(res.status, 200);

    const body = (await res.json()) as { limit: number };

    assert.equal(body.limit, 5);
  } finally {
    await server.close();
  }
});

test('unknown route returns 404', async () => {
  const server = await startTestServer([UsersController], [UsersService]);

  try {
    const res = await fetch(`${server.url}/nope`);

    assert.equal(res.status, 404);
  } finally {
    await server.close();
  }
});
