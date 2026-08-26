import 'reflect-metadata';

import type { TlsOptions } from 'node:tls';

import { Container, type ProviderDefinition } from './container';
import type { Constructor } from './tokens';
import { Router, type Route, type RouteMatch } from './router';
import { ValidationPipe } from './pipes/validation.pipe';
import { ZodValidationPipe } from './pipes/zod-validation.pipe';
import { HttpException } from './http-exception';
import { ForbiddenException, NotFoundError } from './errors';
import { requestContext, resolveRequestId } from './context/request-context';
import { getGuards } from './decorators/use-guards';
import { getInterceptors } from './decorators/use-interceptors';
import { runFilters } from './filters/exception.filter';
import type {
  ApplicationOptions,
  CallHandler,
  CanActivate,
  ExceptionFilter,
  ExecutionContext,
  HookRef,
  Middleware,
  NestInterceptor,
  PipeMetadata,
  PipeTransform,
} from './lifecycle/contracts';
import {
  listen as serverListen,
  listenTls as serverListenTls,
  type RawRequest,
  type RawResponse,
  type ServerHandle,
} from './server/http-server';

export type { ServerHandle };

type ControllerInstance = Record<PropertyKey, (...args: unknown[]) => unknown>;

export class Application {
  readonly container: Container;
  private readonly router: Router;
  private readonly instances = new Map<Constructor, ControllerInstance>();
  private readonly validationPipe: ValidationPipe;
  private readonly zodPipe: ZodValidationPipe;
  private readonly middleware: Middleware[];
  private readonly guards: CanActivate[];
  private readonly interceptors: NestInterceptor[];
  private readonly pipes: PipeTransform[];
  private readonly filters: ExceptionFilter[];

  constructor(
    controllers: Constructor[],
    providers: ProviderDefinition[] = [],
    options: ApplicationOptions = {},
  ) {
    this.container = new Container();

    for (const provider of providers) {
      this.container.register(provider);
    }

    this.router = new Router(controllers);

    for (const controller of controllers) {
      this.container.register(controller);
      this.instances.set(controller, this.container.resolve(controller) as ControllerInstance);
    }

    this.validationPipe = this.container.resolve(ValidationPipe);
    this.zodPipe = this.container.resolve(ZodValidationPipe);

    this.middleware = options.middleware ?? [];
    this.guards = (options.guards ?? []).map((g) => this.resolveHook<CanActivate>(g));
    this.interceptors = (options.interceptors ?? []).map((i) => this.resolveHook<NestInterceptor>(i));
    this.pipes = (options.pipes ?? []).map((p) => this.resolveHook<PipeTransform>(p));
    this.filters = (options.filters ?? []).map((f) => this.resolveHook<ExceptionFilter>(f));
  }

  async dispatch(request: RawRequest): Promise<RawResponse> {
    const requestId = resolveRequestId(request.headers);

    return requestContext.run({ requestId }, async () => {
      let response: RawResponse;

      try {
        response = await this.handle(request, requestId);
      } catch (error) {
        response = runFilters(this.filters, error);
      }

      response.headers = { ...response.headers, 'X-Request-Id': requestId };

      return response;
    });
  }

  private async handle(request: RawRequest, requestId: string): Promise<RawResponse> {
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
    const matched = this.router.match(request.method, url.pathname);

    if (!matched) {
      throw new NotFoundError(`Cannot ${request.method} ${url.pathname}`);
    }

    const body = parseJsonBody(request.body, request.method);
    const ctx: ExecutionContext = { request, route: matched.route, requestId };

    for (const mw of this.middleware) {
      await mw(ctx);
    }

    const guards = [...this.guards, ...this.routeGuards(matched.route)];

    for (const guard of guards) {
      const allowed = await guard.canActivate(ctx);

      if (!allowed) throw new ForbiddenException();
    }

    const interceptors = [...this.interceptors, ...this.routeInterceptors(matched.route)];
    const core: CallHandler = async () => {
      const args = await this.buildArguments(matched, url, body);
      const instance = this.instances.get(matched.route.controller)!;

      return instance[matched.route.handlerName](...args);
    };

    const result = await runInterceptors(interceptors, ctx, core);

    return { status: defaultStatus(request.method), body: result };
  }

  private resolveHook<T>(ref: HookRef<T>): T {
    return typeof ref === 'function' ? (this.container.resolve(ref as Constructor<T>) as T) : ref;
  }

  private routeGuards(route: Route): CanActivate[] {
    return getGuards(route.controller, route.handlerName).map((g) =>
      this.resolveHook<CanActivate>(g),
    );
  }

  private routeInterceptors(route: Route): NestInterceptor[] {
    return getInterceptors(route.controller, route.handlerName).map((i) =>
      this.resolveHook<NestInterceptor>(i),
    );
  }

  listen(port = 0): Promise<ServerHandle> {
    return serverListen(port, (request) => this.dispatch(request));
  }

  listenTls(port: number, options: TlsOptions): Promise<ServerHandle> {
    return serverListenTls(port, options, (request) => this.dispatch(request));
  }

  private async buildArguments(matched: RouteMatch, url: URL, body: unknown): Promise<unknown[]> {
    const { route, pathParams } = matched;
    const args: unknown[] = [];

    for (const param of route.params) {
      switch (param.source) {
        case 'param':
          args[param.index] = param.name ? pathParams[param.name] : pathParams;
          break;
        case 'query':
          args[param.index] = param.name
            ? url.searchParams.get(param.name)
            : Object.fromEntries(url.searchParams);
          break;
        case 'body':
          args[param.index] = await this.runBodyPipes(param, body, route.paramTypes[param.index]);
          break;
      }
    }

    return args;
  }

  private async runBodyPipes(
    param: { schema?: unknown },
    body: unknown,
    metatype: unknown,
  ): Promise<unknown> {
    const meta: PipeMetadata = { type: 'body', schema: param.schema, metatype };
    let value = body;

    for (const pipe of this.pipes) {
      value = await pipe.transform(value, meta);
    }

    if (param.schema) {
      return this.zodPipe.transform(value, meta);
    }

    return this.validationPipe.transform(value, metatype);
  }
}

function runInterceptors(
  interceptors: NestInterceptor[],
  ctx: ExecutionContext,
  core: CallHandler,
): Promise<unknown> {
  const chain = interceptors.reduceRight<CallHandler>(
    (next, interceptor) => () => interceptor.intercept(ctx, next),
    core,
  );

  return chain();
}

function defaultStatus(method: string): number {
  return method === 'POST' ? 201 : 200;
}

function parseJsonBody(raw: string | undefined, method: string): unknown {
  if (method === 'GET' || method === 'HEAD' || method === 'DELETE') {
    return undefined;
  }
  if (raw === undefined || raw === '') {
    return undefined;
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpException(400, { statusCode: 400, message: 'Invalid JSON body' });
  }
}