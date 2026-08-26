import 'reflect-metadata';

import { performance } from 'node:perf_hooks';

import { Injectable } from '../decorators/injectable';
import type { CallHandler, ExecutionContext, NestInterceptor } from '../lifecycle/contracts';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<unknown> {
    const start = performance.now();

    try {
      return await next();
    } finally {
      const ms = performance.now() - start;

      console.log(`${ctx.request.method} ${ctx.request.url} — ${ms.toFixed(1)} ms`);
    }
  }
}