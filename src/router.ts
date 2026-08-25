import 'reflect-metadata';

import type { Constructor } from './tokens';
import { getControllerPrefix } from './decorators/controller';
import { getRoutes, type HttpMethod } from './decorators/methods';
import { getParamMetadata, type ParamMetadata } from './decorators/params';

export interface Route {
  controller: Constructor
  handlerName: string | symbol;
  httpMethod: HttpMethod;
  params: ParamMetadata[];
  paramTypes: unknown[];
}

interface CompiledRoute extends Route {
  regex: RegExp;
  keys: string[];
}

export interface RouteMatch {
  route: Route;
  pathParams: Record<string, string>;
}

export class Router {
  private readonly routes: CompiledRoute[] = [];

  constructor(controllers: Constructor[]) {
    for (const controller of controllers) {
      const prefix = getControllerPrefix(controller);
      const prototype = (controller as Function).prototype;

      for (const route of getRoutes(controller)) {
        const fullPath = joinPaths(prefix, route.path);
        const { regex, keys } = compilePath(fullPath);

        this.routes.push({
          controller,
          handlerName: route.handlerName,
          httpMethod: route.httpMethod,
          params: getParamMetadata(controller, route.handlerName),
          paramTypes:
            Reflect.getMetadata('design:paramtypes', prototype, route.handlerName) ?? [],
          regex,
          keys,
        });
      }
    }
  }

  match(httpMethod: string, pathname: string): RouteMatch | null {
    for (const route of this.routes) {
      if (route.httpMethod !== httpMethod) continue;

      const found = route.regex.exec(pathname);

      if (!found) continue;

      const pathParams: Record<string, string> = {};

      route.keys.forEach((key, i) => {
        pathParams[key] = decodeURIComponent(found[i + 1]);
      });

      return { route, pathParams };
    }

    return null;
  }
}

export function joinPaths(...parts: string[]): string {
  const segments = parts
    .flatMap((part) => part.split('/'))
    .filter(Boolean);

  return '/' + segments.join('/');
}

function compilePath(path: string): { regex: RegExp; keys: string[] } {
  const keys: string[] = [];
  const source = path
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      if (segment.startsWith(':')) {
        keys.push(segment.slice(1));

        return '([^/]+)';
      }

      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');

  return { regex: new RegExp(`^/${source}/?$`), keys };
}