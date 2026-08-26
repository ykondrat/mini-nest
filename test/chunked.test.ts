import 'reflect-metadata';

import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as net from 'node:net';

import { Controller } from '../src/decorators/controller';
import { Post } from '../src/decorators/methods';
import { Body } from '../src/decorators/params';
import { CreateUserDto } from '../src/dto/create-user.dto';
import { decodeChunked } from '../src/server/http-server';
import { startTestServer } from './helpers';

@Controller('users')
class UsersController {
  @Post()
  create(@Body() dto: CreateUserDto) {
    return { isDtoInstance: dto instanceof CreateUserDto, email: dto.email, name: dto.name };
  }
}

function chunk(s: string): string {
  return s.length.toString(16) + '\r\n' + s + '\r\n';
}

function sendRaw(host: string, port: number, payload: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, host, () => socket.write(payload));
    let data = '';

    socket.setEncoding('utf-8');
    socket.on('data', (part) => {
      data += part;
    });
    socket.on('end', () => resolve(data));
    socket.on('error', reject);
  });
}

test('decodeChunked: reassembles a body split across chunks', () => {
  const buf = Buffer.from(chunk('{"a":') + chunk('1}') + '0\r\n\r\n');

  assert.equal(decodeChunked(buf)?.toString('utf-8'), '{"a":1}');
});

test('decodeChunked: returns null while the terminating 0-chunk is missing', () => {
  const buf = Buffer.from(chunk('{"a":1}'));

  assert.equal(decodeChunked(buf), null);
});

test('POST with Transfer-Encoding: chunked → body decoded, validated, 201', async () => {
  const server = await startTestServer([UsersController]);

  try {
    const url = new URL(server.url);
    const json = JSON.stringify({ email: 'ada@example.com', name: 'Ada' });
    const mid = Math.floor(json.length / 2);
    const payload =
      'POST /users HTTP/1.1\r\n' +
      `Host: ${url.host}\r\n` +
      'Content-Type: application/json\r\n' +
      'Transfer-Encoding: chunked\r\n' +
      '\r\n' +
      chunk(json.slice(0, mid)) +
      chunk(json.slice(mid)) +
      '0\r\n\r\n';

    const raw = await sendRaw(url.hostname, Number(url.port), payload);
    const separator = raw.indexOf('\r\n\r\n');
    const head = raw.slice(0, separator);
    const body = raw.slice(separator + 4);

    assert.match(head, /^HTTP\/1\.1 201/);

    const parsed = JSON.parse(body) as { isDtoInstance: boolean; email: string };

    assert.equal(parsed.isDtoInstance, true);
    assert.equal(parsed.email, 'ada@example.com');
  } finally {
    await server.close();
  }
});