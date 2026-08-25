import 'reflect-metadata';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Controller } from '../src/decorators/controller';
import { Get } from '../src/decorators/methods';
import { Injectable } from '../src/decorators/injectable';
import { Application } from '../src/dispatcher';

@Injectable()
class UsersService {}

@Controller('users')
class UsersController {
  constructor(readonly service: UsersService) {}

  @Get()
  list() {
    return [];
  }
}

test('the container injects the same singleton service into the controller', () => {
  const app = new Application([UsersController], [UsersService]);

  const fromController = app.container.resolve(UsersController).service;
  const fromContainer = app.container.resolve(UsersService);

  assert.strictEqual(fromController, fromContainer);
});