import 'reflect-metadata';

import { Application } from '../src/dispatcher';
import type { ProviderDefinition } from '../src/container';
import type { Constructor } from '../src/tokens';

export interface TestServer {
  app: Application;
  url: string;
  close: () => Promise<void>;
}

export async function startTestServer(
  controllers: Constructor[],
  providers: ProviderDefinition[] = [],
): Promise<TestServer> {
  const app = new Application(controllers, providers);
  const { port, close } = await app.listen(0);

  return { app, url: `http://127.0.0.1:${port}`, close };
}