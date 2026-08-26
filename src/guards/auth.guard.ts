import 'reflect-metadata';

import { Injectable } from '../decorators/injectable';
import type { CanActivate, ExecutionContext } from '../lifecycle/contracts';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const auth = ctx.request.headers['authorization'];

    return typeof auth === 'string' && auth.trim() !== '';
  }
}