import 'reflect-metadata';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Container } from '../src/container';
import { Injectable } from '../src/decorators/injectable';

@Injectable()
class C {
  greet(): string {
    return 'hello from C';
  }
}

@Injectable()
class B {
  constructor(readonly c: C) {}
}

@Injectable()
class A {
  constructor(readonly b: B) {}
}

test('resolves a nested graph recursively (A -> B -> C) with a live C inside', () => {
  const container = new Container();

  const a = container.resolve(A);

  assert.ok(a instanceof A);
  assert.ok(a.b instanceof B, 'A should receive a B');
  assert.ok(a.b.c instanceof C, 'B should receive a C');
  assert.equal(a.b.c.greet(), 'hello from C', 'the nested C must be a live instance');
});