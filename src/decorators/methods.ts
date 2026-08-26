import 'reflect-metadata';

export type HttpMethod = 'GET' | 'POST';

export interface RouteMetadata {
  httpMethod: HttpMethod;
  path: string;
  handlerName: string | symbol;
}

export const ROUTES = Symbol.for('mini-nest:routes');

function createMethodDecorator(httpMethod: HttpMethod) {
  return (path = ''): MethodDecorator =>
    (target, propertyKey) => {
      const controller = target.constructor;
      const routes: RouteMetadata[] =
        Reflect.getOwnMetadata(ROUTES, controller) ?? [];

      routes.push({ httpMethod, path, handlerName: propertyKey });
      Reflect.defineMetadata(ROUTES, routes, controller);
    };
}

export const Get = createMethodDecorator('GET');
export const Post = createMethodDecorator('POST');

export function getRoutes(target: object): RouteMetadata[] {
  return Reflect.getMetadata(ROUTES, target) ?? [];
}
