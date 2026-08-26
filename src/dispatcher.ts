import 'reflect-metadata';

import type { TlsOptions } from 'node:tls';

import { Container, type ProviderDefinition } from './container';
import type { Constructor } from './tokens';
import { Router, type RouteMatch } from './router';
import { ValidationPipe } from './pipes/validation.pipe';
import { HttpException } from './http-exception';
import {
  listen as serverListen,
  listenTls as serverListenTls,
  type RawRequest,
  type RawResponse,
  type ServerHandle,
} from './server/http-server';

export type { ServerHandle };

type ControllerInstance = Record<PropertyKey, (...args: unknown[]) => unknown>;

interface DispatchContext {
  request: RawRequest;
  url: URL;
  match: RouteMatch;
  body: unknown;
  args: unknown[];
  response: RawResponse;
}

type DispatchStage = (ctx: DispatchContext) => void | Promise<void>;

export class Application {
  readonly container: Container;
  private readonly router: Router;
  private readonly instances = new Map<Constructor, ControllerInstance>();
  private readonly validationPipe: ValidationPipe;
  private readonly stages: DispatchStage[];

  constructor(controllers: Constructor[], providers: ProviderDefinition[] = []) {
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

    this.stages = [
      (ctx) => this.resolveUrl(ctx),
      (ctx) => this.matchRoute(ctx),
      (ctx) => this.parseBody(ctx),
      (ctx) => this.buildArgs(ctx),
      (ctx) => this.invokeHandler(ctx),
    ];
  }

  async dispatch(request: RawRequest): Promise<RawResponse> {
    const ctx = { request } as DispatchContext;

    try {
      for (const stage of this.stages) {
        await stage(ctx);
      }

      return ctx.response;
    } catch (error) {
      return toErrorResponse(error);
    }
  }

  private resolveUrl(ctx: DispatchContext): void {
    ctx.url = new URL(ctx.request.url, `http://${ctx.request.headers.host ?? 'localhost'}`);
  }

  private matchRoute(ctx: DispatchContext): void {
    const matched = this.router.match(ctx.request.method, ctx.url.pathname);

    if (!matched) {
      throw new HttpException(404, {
        statusCode: 404,
        message: `Cannot ${ctx.request.method} ${ctx.url.pathname}`,
      });
    }

    ctx.match = matched;
  }

  private parseBody(ctx: DispatchContext): void {
    ctx.body = parseJsonBody(ctx.request.body, ctx.request.method);
  }

  private async buildArgs(ctx: DispatchContext): Promise<void> {
    ctx.args = await this.buildArguments(ctx.match, ctx.url, ctx.body);
  }

  private async invokeHandler(ctx: DispatchContext): Promise<void> {
    const instance = this.instances.get(ctx.match.route.controller)!;
    const result = await instance[ctx.match.route.handlerName](...ctx.args);

    ctx.response = { status: defaultStatus(ctx.request.method), body: result };
  }

  listen(port = 0): Promise<ServerHandle> {
    return serverListen(port, (request) => this.dispatch(request));
  }

  listenTls(port: number, options: TlsOptions): Promise<ServerHandle> {
    return serverListenTls(port, options, (request) => this.dispatch(request));
  }

  private async buildArguments(
    matched: RouteMatch,
    url: URL,
    body: unknown,
  ): Promise<unknown[]> {
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
          args[param.index] = await this.validationPipe.transform(
            body,
            route.paramTypes[param.index],
          );
          break;
      }
    }

    return args;
  }
}

function toErrorResponse(error: unknown): RawResponse {
  if (error instanceof HttpException) {
    return { status: error.status, body: error.body };
  }

  return { status: 500, body: { statusCode: 500, message: 'Internal Server Error' } };
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