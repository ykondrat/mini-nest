import 'reflect-metadata';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ValidationPipe } from '../src/pipes/validation.pipe';
import { HttpException } from '../src/http-exception';
import { CreateUserDto } from '../src/dto/create-user.dto';

test('ValidationPipe returns a DTO instance for a valid payload', async () => {
  const pipe = new ValidationPipe();
  const result = await pipe.transform({ email: 'ada@example.com', name: 'Ada' }, CreateUserDto);

  assert.ok(result instanceof CreateUserDto);
});

test('ValidationPipe throws HttpException(400) listing each invalid field', async () => {
  const pipe = new ValidationPipe();

  await assert.rejects(
    () => pipe.transform({ email: 'bad', name: '' }, CreateUserDto),
    (error: unknown) => {
      assert.ok(error instanceof HttpException);
      assert.equal(error.status, 400);

      const body = error.body as { errors: Array<{ field: string; constraints: string[] }> };

      assert.ok(body.errors.some((e) => e.field === 'email'));

      return true;
    },
  );
});