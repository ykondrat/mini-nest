import 'reflect-metadata';

import type { Constructor } from '../tokens';

export type Scope = 'singleton' | 'transient';

export interface InjectableOptions {
  scope?: Scope;
}

export const INJECTABLE_WATERMARK = Symbol.for('mini-nest:injectable');
export const SCOPE_METADATA = Symbol.for('mini-nest:scope');

export function Injectable(options: InjectableOptions = {}): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(INJECTABLE_WATERMARK, true, target);
    Reflect.defineMetadata(SCOPE_METADATA, options.scope ?? 'singleton', target);
  };
}

export function isInjectable(target: unknown): target is Constructor {
  return (
    typeof target === 'function' &&
    Reflect.getMetadata(INJECTABLE_WATERMARK, target) === true
  );
}

export function getScope(target: Constructor): Scope {
  return (Reflect.getMetadata(SCOPE_METADATA, target) as Scope) ?? 'singleton';
}