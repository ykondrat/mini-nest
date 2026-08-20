# mini-nest

An IoC (Inversion of Control) container — the thing NestJS runs under the hood. It reads the constructor parameter types that TypeScript emits as metadata and assembles the dependency graph for you.

## What it does

- `@Injectable({ scope })` — mark a class as container-buildable.
- Constructor resolution via `design:paramtypes` — dependencies are read from metadata and built recursively.
- `@Inject(token)` — supply an explicit token (a `symbol` or `string`) when the type alone is not enough (interfaces don't exist at runtime).
- Scopes — `singleton` (default, one instance per container) and `transient`(a fresh instance per `resolve`).
- Circular-dependency detection — `A -> B -> A` throws a readable error naming the whole chain, instead of a `RangeError: Maximum call stack size exceeded`.

## Requirements

- Node.js ≥ 22 (the tests use the built-in `node:test` runner)
- TypeScript 6.x (installed as a dev dependency)

## Run

```bash
npm install     # installs deps and builds ./dist (via the `prepare` hook)
npm test        # runs the compiled suite with node:test — expect 5 passing tests
```

`npm test` runs the already-compiled tests in `./dist`, so it needs no compiler
(that is what lets the lean Docker runner run the suite). Rebuild after editing:

```bash
npm run build   # tsc -> ./dist
npm run dev     # watch mode: recompile + re-run the suite on every save
```

## Docker

### Quick start

```bash
docker compose run --rm api npm test
```

`docker compose up --build` runs the suite once and exits (CI-style).

### Dev mode (watch)

`docker compose up` automatically merges `docker-compose.override.yml`, which builds the `builder` stage, bind-mounts `./src`, `./test` and `tsconfig.json`, and runs `npm run dev` — edit a `.ts` file and the suite recompile and re-runs.

### CI mode (no override)

The base file alone is deterministic and has no bind mounts:

```bash
docker compose -f docker-compose.yml up --build
docker compose -f docker-compose.yml config
```

## Usage

```ts
import 'reflect-metadata'; // must be the very first import of your entry point
import { Container, Injectable, Inject } from './src';

@Injectable()
class Logger {
  log(msg: string) { console.log(msg); }
}

@Injectable()
class UserService {
  constructor(private readonly logger: Logger) {} // resolved by type
  greet() { this.logger.log('hi'); }
}

const container = new Container();
const users = container.resolve(UserService); // Logger built and injected for you
```

Interfaces have no runtime type, so inject them by token:

```ts
const CONFIG = Symbol.for('CONFIG');
interface AppConfig { databaseUrl: string; }

@Injectable()
class Database {
  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}
}

const container = new Container();
container.register({ provide: CONFIG, useValue: { databaseUrl: 'postgres://…' } });
const db = container.resolve(Database);
```

Transient scope:

```ts
@Injectable({ scope: 'transient' })
class RequestContext {}

container.resolve(RequestContext) !== container.resolve(RequestContext); // true
```

## How it works

It all comes down to one compiler trick: when `emitDecoratorMetadata` is on and a class has at least one decorator, TypeScript records the constructor's parameter types as real runtime values under a `design:paramtypes` key — so `@Injectable()` both marks the class as buildable and, just by being a decorator, is what makes those types get written down in the first place. At resolve time the container reads them back with `Reflect.getMetadata('design:paramtypes', TheClass)` and builds each dependency recursively before calling `new`.
