import 'reflect-metadata';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Controller } from '../src/decorators/controller';
import { Post } from '../src/decorators/methods';
import { Body } from '../src/decorators/params';
import { createUserSchema, type CreateUserInput } from '../src/schemas/create-user.schema';
import { startTestServer } from './helpers';

@Controller('zusers')
class ZUsersController {
  @Post()
  create(@Body(createUserSchema) dto: CreateUserInput) {
    return { email: dto.email, name: dto.name };
  }
}

test('Zod pipe: valid body → 201 and the handler receives the parsed value', async () => {
  const server = await startTestServer([ZUsersController]);

  try {
    const res = await fetch(`${server.url}/zusers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'ada@example.com', name: 'Ada' }),
    });

    assert.equal(res.status, 201);

    const body = (await res.json()) as { email: string; name: string };

    assert.equal(body.email, 'ada@example.com');
    assert.equal(body.name, 'Ada');
  } finally {
    await server.close();
  }
});

test('Zod pipe: invalid body → 400 with a field list naming email', async () => {
  const server = await startTestServer([ZUsersController]);

  try {
    const res = await fetch(`${server.url}/zusers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', name: 'A' }),
    });

    assert.equal(res.status, 400);

    const body = (await res.json()) as {
      message: string;
      errors: Array<{ field: string; message: string }>;
    };

    assert.equal(body.message, 'Validation failed');
    assert.ok(Array.isArray(body.errors));
    assert.ok(body.errors.some((e) => e.field === 'email'));
  } finally {
    await server.close();
  }
});