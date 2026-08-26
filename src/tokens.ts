export type Constructor<T = unknown> = new (...args: any[]) => T;

export type Token<T = unknown> = symbol | string | Constructor<T>;

export const CONFIG = Symbol.for('CONFIG');

export const DATABASE_POOL = Symbol.for('DATABASE_POOL');
