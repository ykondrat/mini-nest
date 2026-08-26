import 'reflect-metadata';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Controller } from '../src/decorators/controller';
import { Get } from '../src/decorators/methods';
import { Injectable } from '../src/decorators/injectable';
import { UseGuards } from '../src/decorators/use-guards';
import { UseInterceptors } from '../src/decorators/use-interceptors';
import type {
  CallHandler,
  CanActivate,
  ExecutionContext,
  NestInterceptor,
} from '../src/lifecycle/contracts';
import { startTestServer } from './helpers';

const trace: string[] = [];
let handlerCalls = 0;

@Injectable()
class TraceGuard implements CanActivate {
  canActivate(_ctx: ExecutionContext): boolean {
    trace.push('guard');
    return true;
  }
}

@Injectable()
class DenyGuard implements CanActivate {
  canActivate(_ctx: ExecutionContext): boolean {
    return false;
  }
}

@Injectable()
class TraceInterceptor implements NestInterceptor {
  async intercept(_ctx: ExecutionContext, next: CallHandler): Promise<unknown> {
    trace.push('interceptor:before');
    const result = await next();
    trace.push('interceptor:after');
    return result;
  }
}

@Controller('deco')
@UseGuards(TraceGuard)
class DecoController {
  @Get()
  @UseInterceptors(TraceInterceptor)
  read() {
    trace.push('handler');
    return { ok: true };
  }
}

@Controller('deny')
class DenyController {
  @Get()
  @UseGuards(DenyGuard)
  read() {
    handlerCalls += 1;
    return { ok: true };
  }
}

test('@UseGuards (class) + @UseInterceptors (method) run in order via the decorator path', async () => {
  trace.length = 0;
  const server = await startTestServer([DecoController]);

  try {
    const res = await fetch(`${server.url}/deco`);

    assert.equal(res.status, 200);
    assert.deepEqual(trace, ['guard', 'interceptor:before', 'handler', 'interceptor:after']);
  } finally {
    await server.close();
  }
});

test('@UseGuards on a method blocks before the handler → 403', async () => {
  handlerCalls = 0;
  const server = await startTestServer([DenyController]);

  try {
    const res = await fetch(`${server.url}/deny`);

    assert.equal(res.status, 403);
    assert.equal(handlerCalls, 0);
  } finally {
    await server.close();
  }
});