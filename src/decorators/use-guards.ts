
import 'reflect-metadata';

import type { CanActivate, HookRef } from '../lifecycle/contracts';

const CLASS_GUARDS = Symbol.for('mini-nest:guards:class');
const METHOD_GUARDS = Symbol.for('mini-nest:guards:method');

export function UseGuards(...guards: HookRef<CanActivate>[]): ClassDecorator & MethodDecorator {
  const decorator = (target: object, propertyKey?: string | symbol): void => {
    if (propertyKey === undefined) {
      Reflect.defineMetadata(CLASS_GUARDS, guards, target);
      return;
    }

    const ctor = (target as { constructor: object }).constructor;
    const byHandler: Map<string | symbol, HookRef<CanActivate>[]> =
      Reflect.getOwnMetadata(METHOD_GUARDS, ctor) ?? new Map();

    byHandler.set(propertyKey, guards);
    Reflect.defineMetadata(METHOD_GUARDS, byHandler, ctor);
  };

  return decorator as ClassDecorator & MethodDecorator;
}

export function getGuards(
  controller: object,
  handlerName: string | symbol,
): HookRef<CanActivate>[] {
  const classGuards: HookRef<CanActivate>[] = Reflect.getMetadata(CLASS_GUARDS, controller) ?? [];
  const byHandler: Map<string | symbol, HookRef<CanActivate>[]> | undefined = Reflect.getMetadata(
    METHOD_GUARDS,
    controller,
  );

  return [...classGuards, ...(byHandler?.get(handlerName) ?? [])];
}