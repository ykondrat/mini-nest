import 'reflect-metadata';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Controller } from '../src/decorators/controller';
import { Get } from '../src/decorators/methods';
import { NotFoundError } from '../src/errors';
import type { CallHandler, NestInterceptor } from '../src/lifecycle/contracts';
import { startTestServer } from './helpers';

@Controller('boom')
class BoomController {
  @Get()
  explode() {
    throw new Error('boom');
  }

  @Get('missing')
  missing() {
    throw new NotFoundError('widget not found');
  }
}

test('unexpected error → 500 without leaking the message or a stack trace', async () => {
  const server = await startTestServer([BoomController]);

  try {
    const res = await fetch(`${server.url}/boom`);

    assert.equal(res.status, 500);

    const text = await res.text();

    assert.doesNotMatch(text, /boom|at .*\.ts:/);
  } finally {
    await server.close();
  }
});

test('NotFoundError → 404 with a meaningful message', async () => {
  const server = await startTestServer([BoomController]);

  try {
    const res = await fetch(`${server.url}/boom/missing`);

    assert.equal(res.status, 404);

    const body = (await res.json()) as { message: string };

    assert.match(body.message, /widget not found/);
  } finally {
    await server.close();
  }
});

test('exception filter also catches errors thrown by an interceptor', async () => {
  const throwing: NestInterceptor = {
    async intercept(_ctx, _next: CallHandler) {
      throw new NotFoundError('from interceptor');
    },
  };
  const server = await startTestServer([BoomController], [], { interceptors: [throwing] });

  try {
    const res = await fetch(`${server.url}/boom`);

    assert.equal(res.status, 404);
  } finally {
    await server.close();
  }
});