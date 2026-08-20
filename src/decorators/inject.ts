import 'reflect-metadata';

import type { Constructor, Token } from '../tokens';

export type InjectMap = Record<number, Token>;

export const INJECT_TOKENS = Symbol.for('mini-nest:inject-tokens');

export function Inject(token: Token): ParameterDecorator {
  return (target, _propertyKey, parameterIndex) => {
    const existing: InjectMap = Reflect.getOwnMetadata(INJECT_TOKENS, target) ?? {};

    existing[parameterIndex] = token;
    Reflect.defineMetadata(INJECT_TOKENS, existing, target);
  };
}

export function getInjectTokens(target: Constructor): InjectMap {
  return Reflect.getMetadata(INJECT_TOKENS, target) ?? {};
}