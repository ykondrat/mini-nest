import 'reflect-metadata';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Controller } from '../src/decorators/controller';
import { Get } from '../src/decorators/methods';
import { LoggingInterceptor } from '../src/interceptors/logging.interceptor';
import { startTestServer } from './helpers';

@Controller('ping')
class PingController {
  @Get()
  ping() {
    return { pong: true };
  }
}

test('LoggingInterceptor logs the route and a millisecond duration', async () => {
  const logs: string[] = [];
  const original = console.log;

  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };

  try {
    const server = await startTestServer([PingController], [], {
      interceptors: [LoggingInterceptor],
    });

    try {
      const res = await fetch(`${server.url}/ping`);
      assert.equal(res.status, 200);
    } finally {
      await server.close();
    }
  } finally {
    console.log = original;
  }

  const line = logs.find((l) => /ms/.test(l));

  assert.ok(line, 'expected a timing log line');
  assert.match(line, /[0-9]+(\.[0-9]+)? ?ms/);
  assert.match(line, /GET \/ping/);
});