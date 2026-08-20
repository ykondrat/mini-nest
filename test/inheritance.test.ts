import 'reflect-metadata';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Container } from '../src/container';
import { Inject } from '../src/decorators/inject';
import { Injectable } from '../src/decorators/injectable';

const DEP = Symbol.for('INHERITED_DEP');

interface Dep {
  value: number;
}

@Injectable()
class Base {
  constructor(@Inject(DEP) readonly dep: Dep) {}
}

class Child extends Base {}

test('a subclass inherits the parent constructor @Inject tokens', () => {
  const container = new Container();

  container.register({ provide: DEP, useValue: { value: 42 } });

  const child = container.resolve(Child);

  assert.ok(child instanceof Child);
  assert.equal(child.dep.value, 42);
});
