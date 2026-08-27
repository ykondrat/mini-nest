import type { Constructor } from '../tokens';
import type { Route } from '../router';
import type { RawRequest, RawResponse } from '../server/http-server';

export interface ExecutionContext {
  request: RawRequest;
  route: Route;
  requestId: string;
}

export interface CanActivate {
  canActivate(ctx: ExecutionContext): boolean | Promise<boolean>;
}

export type CallHandler = () => Promise<unknown>;

export interface NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Promise<unknown>;
}

export interface PipeMetadata {
  type: 'body' | 'param' | 'query';
  schema?: unknown;
  metatype?: unknown;
}

export interface PipeTransform {
  transform(value: unknown, meta: PipeMetadata): unknown | Promise<unknown>;
}

export type Middleware = (ctx: ExecutionContext) => void | Promise<void>;

export interface ExceptionFilter {
  catch(error: unknown, ctx?: ExecutionContext): RawResponse | null;
}

export type HookRef<T> = T | Constructor<T>;

export interface ApplicationOptions {
  middleware?: Middleware[];
  guards?: HookRef<CanActivate>[];
  interceptors?: HookRef<NestInterceptor>[];
  pipes?: HookRef<PipeTransform>[];
  filters?: HookRef<ExceptionFilter>[];
}