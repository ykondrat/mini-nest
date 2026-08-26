import 'reflect-metadata';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Controller } from '../src/decorators/controller';
import { Post } from '../src/decorators/methods';
import { Body } from '../src/decorators/params';
import { CreateUserDto } from '../src/dto/create-user.dto';
import { ValidationPipe } from '../src/pipes/validation.pipe';
import { startTestServer } from './helpers';

@Controller('users')
class UsersController {
  @Post()
  create(@Body() dto: CreateUserDto) {
    return {
      isDtoInstance: dto instanceof CreateUserDto,
      email: (dto as { email?: string }).email,
    };
  }
}

test('ValidationPipe is resolved via the container and replaceable by a provider', async () => {
  const seen: unknown[] = [];
  const spyPipe = {
    async transform(value: unknown): Promise<unknown> {
      seen.push(value);

      return value;
    },
  };
  const server = await startTestServer(
    [UsersController],
    [{ provide: ValidationPipe, useValue: spyPipe }],
  );

  try {
    const res = await fetch(`${server.url}/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'zoe@example.com', name: 'Zoe' }),
    });

    assert.equal(res.status, 201);

    const body = (await res.json()) as { isDtoInstance: boolean; email: string };

    assert.equal(seen.length, 1);
    assert.equal(body.isDtoInstance, false);
    assert.equal(body.email, 'zoe@example.com');
  } finally {
    await server.close();
  }
});