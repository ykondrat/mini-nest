import 'reflect-metadata';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Controller } from '../src/decorators/controller';
import { Post } from '../src/decorators/methods';
import { Body } from '../src/decorators/params';
import { CreateUserDto } from '../src/dto/create-user.dto';
import { startTestServer } from './helpers';

@Controller('users')
class UsersController {
  @Post()
  create(@Body() dto: CreateUserDto) {
    return {
      isDtoInstance: dto instanceof CreateUserDto,
      email: dto.email,
      name: dto.name,
    };
  }
}

test('valid body → 201 and the handler receives a CreateUserDto instance', async () => {
  const server = await startTestServer([UsersController]);
  try {
    const res = await fetch(`${server.url}/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'ada@example.com', name: 'Ada' }),
    });

    assert.equal(res.status, 201);

    const body = (await res.json()) as { isDtoInstance: boolean; email: string };

    assert.equal(body.isDtoInstance, true);
    assert.equal(body.email, 'ada@example.com');
  } finally {
    await server.close();
  }
});

test('invalid body → 400 with a field list that names "email"', async () => {
  const server = await startTestServer([UsersController]);
  try {
    const res = await fetch(`${server.url}/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', name: 'Ada' }),
    });
    assert.equal(res.status, 400);

    const text = await res.text();

    assert.match(text, /email/);

    const body = JSON.parse(text) as { errors: Array<{ field: string; constraints: string[] }> };

    assert.ok(Array.isArray(body.errors));
    assert.ok(body.errors.some((e) => e.field === 'email'));
  } finally {
    await server.close();
  }
});