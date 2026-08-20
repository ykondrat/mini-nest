import 'reflect-metadata';

import type { Constructor, Token } from './tokens';
import { getInjectTokens } from './decorators/inject';
import { getScope, isInjectable, type Scope } from './decorators/injectable';

type Provider<T> =
  | { kind: 'class'; useClass: Constructor<T>; scope: Scope }
  | { kind: 'value'; useValue: T };

export type ProviderDefinition<T = unknown> =
  | Constructor<T>
  | { provide: Token<T>; useClass: Constructor<T>; scope?: Scope }
  | { provide: Token<T>; useValue: T };

export class Container {
  private readonly providers = new Map<Token, Provider<unknown>>();
  private readonly singletons = new Map<Token, unknown>();

  register<T>(definition: ProviderDefinition<T>): this {
    if (typeof definition === 'function') {
      this.providers.set(definition, {
        kind: 'class',
        useClass: definition,
        scope: getScope(definition),
      });

      return this;
    }

    if ('useValue' in definition) {
      this.providers.set(definition.provide, {
        kind: 'value',
        useValue: definition.useValue,
      });

      return this;
    }

    this.providers.set(definition.provide, {
      kind: 'class',
      useClass: definition.useClass,
      scope: definition.scope ?? getScope(definition.useClass),
    });

    return this;
  }

  resolve<T>(token: Token<T>): T {
    return this.resolveToken(token, []) as T;
  }

  private resolveToken(token: Token, path: readonly Constructor[]): unknown {
    const provider = this.getProvider(token);

    if (provider.kind === 'value') {
      return provider.useValue;
    }

    return this.resolveClass(token, provider.useClass, provider.scope, path);
  }

  private getProvider(token: Token): Provider<unknown> {
    const existing = this.providers.get(token);

    if (existing) {
      return existing;
    }

    if (typeof token === 'function') {
      const displayName = token.name;

      if (!isInjectable(token)) {
        throw new Error(
          `Cannot resolve ${displayName}: the class is not decorated with @Injectable().`,
        );
      }

      const provider: Provider<unknown> = {
        kind: 'class',
        useClass: token,
        scope: getScope(token),
      };

      this.providers.set(token, provider);

      return provider;
    }

    throw new Error(
      `No provider registered for token ${describeToken(token)}. ` +
        `Register it with container.register({ provide, useValue | useClass }).`,
    );
  }

  private resolveClass(
    token: Token,
    cls: Constructor,
    scope: Scope,
    path: readonly Constructor[],
  ): unknown {
    if (scope === 'singleton' && this.singletons.has(token)) {
      return this.singletons.get(token);
    }

    if (path.includes(cls)) {
      const chain = [...path, cls].map((c) => c.name).join(' -> ');

      throw new Error(`Circular dependency detected: ${chain}`);
    }

    const instance = this.instantiate(cls, [...path, cls]);

    if (scope === 'singleton') {
      this.singletons.set(token, instance);
    }

    return instance;
  }

  private instantiate(cls: Constructor, path: readonly Constructor[]): unknown {
    const paramTypes: unknown[] = Reflect.getMetadata('design:paramtypes', cls) ?? [];
    const injectTokens = getInjectTokens(cls);

    const args = paramTypes.map((paramType, index) => {
      const dependency = injectTokens[index] ?? (paramType as Token);

      this.assertResolvable(cls, index, dependency);

      return this.resolveToken(dependency, path);
    });

    return new cls(...args);
  }

  private assertResolvable(
    cls: Constructor,
    index: number,
    dependency: Token | undefined | null,
  ): asserts dependency is Token {
    if (dependency === undefined || dependency === null) {
      throw new Error(
        `Cannot resolve parameter #${index} of ${cls.name}: no type metadata. ` +
          `Is the class @Injectable() and is emitDecoratorMetadata enabled?`,
      );
    }
    if (dependency === Object || dependency === Function) {
      throw new Error(
        `Cannot resolve parameter #${index} of ${cls.name}: the type erases to ` +
          `'${(dependency as Function).name}' at runtime (an interface, object literal, or 'any'). ` +
          `Add @Inject(token) with an explicit token.`,
      );
    }
    if (
      dependency === String ||
      dependency === Number ||
      dependency === Boolean ||
      (dependency as unknown) === Symbol
    ) {
      throw new Error(
        `Cannot resolve parameter #${index} of ${cls.name}: primitive type ` +
          `'${(dependency as Function).name}'. Use @Inject(token) and register a value.`,
      );
    }
  }
}

function describeToken(token: Token): string {
  if (typeof token === 'symbol') {
    return token.toString();
  }
  if (typeof token === 'function') {
    return token.name;
  }

  return `"${String(token)}"`;
}