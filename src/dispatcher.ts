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

export class Application {
  readonly container: Container;
  private readonly router: Router;
  private readonly instances = new Map<Constructor, ControllerInstance>();
  private readonly validationPipe = new ValidationPipe();

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
  }

  async dispatch(request: RawRequest): Promise<RawResponse> {
    try {
      const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
      const matched = this.router.match(request.method, url.pathname);

      if (!matched) {
        return { status: 404, body: { statusCode: 404, message: `Cannot ${request.method} ${url.pathname}` } };
      }

      const body = parseJsonBody(request.body, request.method);
      const args = await this.buildArguments(matched, url, body);
      const instance = this.instances.get(matched.route.controller)!;
      const result = await instance[matched.route.handlerName](...args);

      return { status: defaultStatus(request.method), body: result };
    } catch (error) {
      if (error instanceof HttpException) {
        return { status: error.status, body: error.body };
      }
      return { status: 500, body: { statusCode: 500, message: 'Internal Server Error' } };
    }
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