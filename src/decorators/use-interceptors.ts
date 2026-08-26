import 'reflect-metadata';

import type { HookRef, NestInterceptor } from '../lifecycle/contracts';

const CLASS_INTERCEPTORS = Symbol.for('mini-nest:interceptors:class');
const METHOD_INTERCEPTORS = Symbol.for('mini-nest:interceptors:method');

export function UseInterceptors(
  ...interceptors: HookRef<NestInterceptor>[]
): ClassDecorator & MethodDecorator {
  const decorator = (target: object, propertyKey?: string | symbol): void => {
    if (propertyKey === undefined) {
      Reflect.defineMetadata(CLASS_INTERCEPTORS, interceptors, target);
      return;
    }

    const ctor = (target as { constructor: object }).constructor;
    const byHandler: Map<string | symbol, HookRef<NestInterceptor>[]> =
      Reflect.getOwnMetadata(METHOD_INTERCEPTORS, ctor) ?? new Map();

    byHandler.set(propertyKey, interceptors);
    Reflect.defineMetadata(METHOD_INTERCEPTORS, byHandler, ctor);
  };

  return decorator as ClassDecorator & MethodDecorator;
}

export function getInterceptors(
  controller: object,
  handlerName: string | symbol,
): HookRef<NestInterceptor>[] {
  const classInterceptors: HookRef<NestInterceptor>[] =
    Reflect.getMetadata(CLASS_INTERCEPTORS, controller) ?? [];
  const byHandler: Map<string | symbol, HookRef<NestInterceptor>[]> | undefined =
    Reflect.getMetadata(METHOD_INTERCEPTORS, controller);

  return [...classInterceptors, ...(byHandler?.get(handlerName) ?? [])];
}