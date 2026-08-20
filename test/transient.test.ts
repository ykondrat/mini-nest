import 'reflect-metadata';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Container } from '../src/container';
import { Injectable } from '../src/decorators/injectable';

@Injectable({ scope: 'transient' })
class Task {}

test('transient scope: a fresh instance is returned on every resolve', () => {
  const container = new Container();

  const first = container.resolve(Task);
  const second = container.resolve(Task);

  assert.notStrictEqual(first, second, 'transient must produce distinct instances');
});