import 'reflect-metadata';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Container } from '../src/container';
import { Inject } from '../src/decorators/inject';
import { Injectable } from '../src/decorators/injectable';

const A_TOKEN = Symbol.for('CYCLE_A');
const B_TOKEN = Symbol.for('CYCLE_B');

@Injectable()
class A {
  constructor(@Inject(B_TOKEN) readonly b: unknown) {}
}

@Injectable()
class B {
  constructor(@Inject(A_TOKEN) readonly a: unknown) {}
}

test('circular dependency throws a readable error naming the whole chain', () => {
  const container = new Container();

  container.register({ provide: A_TOKEN, useClass: A });
  container.register({ provide: B_TOKEN, useClass: B });

  let error: unknown;

  try {
    container.resolve(A_TOKEN);
  } catch (caught) {
    error = caught;
  }

  assert.ok(error instanceof Error, 'a cycle must throw');
  assert.ok(
    !(error instanceof RangeError),
    'must fail with a named-chain error, not a "Maximum call stack size" RangeError',
  );
  assert.match(
    (error as Error).message,
    /A -> B -> A/,
    `expected the chain A -> B -> A, got: ${(error as Error).message}`,
  );
});