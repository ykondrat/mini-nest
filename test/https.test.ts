import 'reflect-metadata';

import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as tls from 'node:tls';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { Controller } from '../src/decorators/controller';
import { Get } from '../src/decorators/methods';
import { Param } from '../src/decorators/params';
import { Injectable } from '../src/decorators/injectable';
import { Application } from '../src/dispatcher';

const certDir = path.join(process.cwd(), 'certs');
const keyPath = path.join(certDir, 'key.pem');
const certPath = path.join(certDir, 'cert.pem');
const hasCerts = fs.existsSync(keyPath) && fs.existsSync(certPath);

@Injectable()
class UsersService {
  find(id: number) {
    return { id, name: `user-${id}` };
  }
}

@Controller('users')
class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.users.find(Number(id));
  }
}

function tlsRequest(port: number, raw: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ port, host: '127.0.0.1', rejectUnauthorized: false }, () => {
      socket.write(raw);
    });

    let data = '';

    socket.on('data', (chunk) => (data += chunk.toString('utf-8')));
    socket.on('end', () => resolve(data));
    socket.on('error', reject);
  });
}

test(
  'HTTPS over TLS: GET /users/7 through the raw tls transport',
  { skip: hasCerts ? false : 'no certs — run `npm run certs`' },
  async () => {
    const app = new Application([UsersController], [UsersService]);
    const { port, close } = await app.listenTls(0, {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    });

    try {
      const raw = 'GET /users/7 HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n';
      const response = await tlsRequest(port, raw);

      assert.match(response, /^HTTP\/1\.1 200 OK/);
      assert.match(response, /"id":7/);
    } finally {
      await close();
    }
  },
);
