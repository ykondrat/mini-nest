# mini-nest

An IoC (Inversion of Control) container — the thing NestJS runs under the hood. It reads the constructor parameter types that TypeScript emits as metadata and assembles the dependency graph for you.

## What it does

**Dependency injection**

- `@Injectable({ scope })` — mark a class as container-buildable.
- Constructor resolution via `design:paramtypes` — dependencies are read from metadata and built recursively.
- `@Inject(token)` — supply an explicit token (a `symbol` or `string`) when the type alone is not enough (interfaces don't exist at runtime).
- Scopes — `singleton` (default, one instance per container) and `transient` (a fresh instance per `resolve`).
- Circular-dependency detection — `A -> B -> A` throws a readable error naming the whole chain, instead of a `RangeError: Maximum call stack size exceeded`.

**HTTP layer**

- `@Controller(prefix)` with `@Get(path)` / `@Post(path)` — routes are assembled from metadata; a full path = controller prefix and method path.
- `@Body()`, `@Param(name)`, `@Query(name)` — param decorators record where each argument comes from; the dispatcher fills them in at call time.
- A dispatcher over a hand-rolled HTTP/1.1 server (raw `net` for HTTP, `tls` for HTTPS — no `http`/`https` modules) — parses the request bytes, matches the route, builds the argument array, calls the handler through the container, and serializes the result to JSON.
- DTO validation through a `ValidationPipe` (class-validator) — an invalid body returns `400` with a field list; a valid body reaches the handler as a DTO instance.
- The demo `/users` feature is backed by Postgres — the `pg` connection pool is registered as a value provider and injected into `UsersService` via `@Inject(DATABASE_POOL)`.

## Requirements

- Node.js ≥ 22 (the tests use the built-in `node:test` runner)
- TypeScript 6.x (installed as a dev dependency)
- Docker (optional — for the Postgres-backed demo and the DB integration test)

## Run

```bash
npm install     # install dependencies
npm test        # compiles ./dist (via `pretest`), then runs the node:test suite
```

`pretest` builds first, then `npm test` runs the compiled suite from `./dist` (in the production Docker image the build is skipped and the prebuilt `./dist` is used). Other scripts:

```bash
npm run build              # tsc -> ./dist
npm run dev                # watch: recompile + re-run the suite on every save
npm run build && npm start # run the demo API (src/main.ts) on PORT (default 3000)
```

## Docker

The Compose stack is `api` + `postgres` (Postgres 17; schema and seed come from `db/init.sql`).

### Dev mode (live server + hot reload)

`docker compose up` automatically merges `docker-compose.override.yml`: it builds the
`dev` stage (non-root `node`, like prod), bind-mounts `./src` and `tsconfig.json`, and runs
`npm run dev:server` (`tsc -w` + `node --watch`). Edit a `.ts` file on the host → it
recompiles and the API restarts, backed by the same Postgres.

```bash
docker compose up --build            # dev: API on :3000 with hot reload
curl localhost:3000/users            # [{"id":1,"name":"John Snow",...}, ...]  (seeded)
docker compose down -v               # stop and drop the DB volume
```

### Prod / CI mode (no override)

Pass `-f docker-compose.yml` to skip the override — the prod image runs `npm start` (or `npm test`):

```bash
docker compose -f docker-compose.yml up --build      # prod-style: npm start, no reload
docker compose -f docker-compose.yml run --rm api npm test # 15 pass + 1 skip (TLS) + the Postgres test
```

The image is multi-stage (builder → prod runner on `node:22-slim`, non-root); `Dockerfile.single` is kept for the size comparison. Runtime config is env-based (`PG*`, `PORT`, `NODE_ENV`) — see `.env.example`; the defaults match `docker-compose.yml`.

## Usage

```ts
import 'reflect-metadata';
import { Container } from './src/container';
import { Injectable } from './src/decorators/injectable';
import { Inject } from './src/decorators/inject';

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

### HTTP layer

```ts
import { Application } from './src/dispatcher';
import { Controller } from './src/decorators/controller';
import { Get, Post } from './src/decorators/methods';
import { Body, Param, Query } from './src/decorators/params';
import { CreateUserDto } from './src/dto/create-user.dto';

@Controller('users')
class UsersController {
  constructor(private readonly users: UsersService) {} // injected by the container

  @Get(':id')
  findOne(@Param('id') id: string) { return this.users.findOne(Number(id)); }

  @Get()
  list(@Query('limit') limit: string) { return this.users.list(Number(limit)); }

  @Post()
  create(@Body() dto: CreateUserDto) { return this.users.create(dto); } // dto is a validated instance
}

// UsersService reads from Postgres, so register the pool as a provider:
const pool = createPool();                                   // from ./src/database/database
const app = new Application(
  [UsersController],
  [{ provide: DATABASE_POOL, useValue: pool }, UsersService], // pool injected via @Inject(DATABASE_POOL)
);
app.listen(3000);
```

The bundled demo wires exactly this and reads from Postgres, so run the full stack with Docker:

```bash
docker compose up --build

curl localhost:3000/users                          # seeded users from the DB
curl localhost:3000/users/1                         # {"id":1,"name":"John Snow",...}   @Param
curl 'localhost:3000/users?limit=1'                # [{...}]                            @Query
curl -X POST localhost:3000/users -H 'content-type: application/json' \
     -d '{"email":"grace@example.com","name":"Grace"}'   # 201  @Body (valid) → INSERT
curl -X POST localhost:3000/users -H 'content-type: application/json' \
     -d '{"email":"nope","name":"G"}'               # 400 {errors:[{field:"email",...}]}
```

### HTTPS (TLS)

The same dispatcher runs over TLS — once TLS decrypts the stream, the bytes above it are identical HTTP/1.1. Generate a self-signed cert and start the HTTPS demo (needs a reachable Postgres — set `PG*` env or run one via Docker):

```bash
npm run certs                          # writes certs/{key,cert}.pem (self-signed, localhost)
npm run build && npm run start:https   # https://localhost:3443
curl -k https://localhost:3443/users/1 # {"id":1,"name":"John Snow",...}
```

`app.listenTls(port, { key, cert })` is the HTTPS counterpart of `app.listen(port)`.

### Transport — a from-scratch server (not `node:http`)

This build replaces `node:http` entirely: the dispatcher speaks HTTP/1.1 directly over raw sockets — `net` for HTTP, `tls` for HTTPS — reusing the parser / serialiser / connection-driver from the [`http-tls`](../http-tls) project in `src/server/http-server.ts` (extended to read the request body by `Content-Length`). The server lives in `src/server/`; `dispatcher.ts` is the HTTP layer that sits **on top of** it — its routing/DI/validation core (`Application.dispatch`) is transport-agnostic, so `listen` (net) and `listenTls` (tls) share one code path. This deviates from Part 2's literal "dispatcher over `node:http`" — the tests still drive it with `fetch` / `curl` (it emits valid HTTP/1.1); it's just built one layer lower.

## How it works

It all comes down to one compiler trick: when `emitDecoratorMetadata` is on and a class has at least one decorator, TypeScript records the constructor's parameter types as real runtime values under a `design:paramtypes` key — so `@Injectable()` both marks the class as buildable and, just by being a decorator, is what makes those types get written down in the first place. At resolve time the container reads them back with `Reflect.getMetadata('design:paramtypes', TheClass)` and builds each dependency recursively before calling `new`.

How does a param decorator know where to inject the value? A parameter decorator receives `(target, propertyKey, parameterIndex)`, and that `parameterIndex` is the whole trick. `@Param` / `@Query` / `@Body` don't read the request themselves — they just record `{ index, source, name }` into a per-method map kept in the controller's metadata (a `Map<handlerName, ParamMetadata[]>`). When a request comes in, the dispatcher looks that map up for the matched handler and, for each entry, pulls the value from the right place — a path param, the query string, or the parsed body — and drops it at `args[index]`, then spreads `args` into the method call. Because placement is keyed by *index*, the well-known decorator order (parameter decorators run first, then the method decorator, then the class decorator) never matters. `@Body` goes one step further: it reads the handler's reflected `design:paramtypes` to find the DTO class, and the `ValidationPipe` does `plainToInstance(Dto, body)` → `validate(instance)` — so the method receives a genuine DTO instance, or the request gets a `400` listing `{ field, constraints }` for every rule that failed.
