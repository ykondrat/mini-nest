import 'reflect-metadata';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Controller } from '../src/decorators/controller';
import { Post } from '../src/decorators/methods';
import { Body } from '../src/decorators/params';
import type {
  CallHandler,
  ExecutionContext,
  Middleware,
  NestInterceptor,
  PipeTransform,
} from '../src/lifecycle/contracts';
import { startTestServer } from './helpers';

const order: string[] = [];

@Controller('flow')
class FlowController {
  @Post()
  run(@Body() _body: unknown) {
    order.push('handler');

    return { ok: true };
  }
}

test('lifecycle order: middleware → guard → interceptor:before → pipe → handler → interceptor:after', async () => {
  order.length = 0;

  const middleware: Middleware = () => {
    order.push('middleware');
  };
  const guard = () => {
    order.push('guard');
    return true;
  };
  const interceptor: NestInterceptor = {
    async intercept(_ctx: ExecutionContext, next: CallHandler) {
      order.push('interceptor:before');
      const result = await next();
      order.push('interceptor:after');
      return result;
    },
  };
  const pipe: PipeTransform = {
    transform(value: unknown) {
      order.push('pipe');
      return value;
    },
  };

  const server = await startTestServer([FlowController], [], {
    middleware: [middleware],
    guards: [{ canActivate: guard }],
    interceptors: [interceptor],
    pipes: [pipe],
  });

  try {
    const res = await fetch(`${server.url}/flow`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });

    assert.equal(res.status, 201);
    assert.deepEqual(order, [
      'middleware',
      'guard',
      'interceptor:before',
      'pipe',
      'handler',
      'interceptor:after',
    ]);
  } finally {
    await server.close();
  }
});