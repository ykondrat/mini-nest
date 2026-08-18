import 'reflect-metadata';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Container } from '../src/container';
import { Injectable } from '../src/decorators/injectable';

@Injectable()
class Service {}

test('singleton (default scope): the same instance is returned every resolve', () => {
  const container = new Container();

  const first = container.resolve(Service);
  const second = container.resolve(Service);

  assert.strictEqual(first, second, 'default scope must be a per-container singleton');
});