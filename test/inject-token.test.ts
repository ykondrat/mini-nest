import 'reflect-metadata';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Container } from '../src/container';
import { Inject } from '../src/decorators/inject';
import { Injectable } from '../src/decorators/injectable';
import { CONFIG } from '../src/tokens';

interface AppConfig {
  databaseUrl: string;
}

@Injectable()
class Database {
  constructor(@Inject(CONFIG) readonly config: AppConfig) {}
}

test('@Inject(token): a dependency registered under a symbol resolves by token', () => {
  const container = new Container();

  container.register({
    provide: CONFIG,
    useValue: { databaseUrl: 'postgres://localhost/app' },
  });

  const db = container.resolve(Database);

  assert.equal(db.config.databaseUrl, 'postgres://localhost/app');
});