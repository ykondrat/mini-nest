import * as net from 'node:net';
import * as tls from 'node:tls';
import type { AddressInfo } from 'node:net';

const CRLF = '\r\n';
const HEADER_END = Buffer.from(CRLF + CRLF, 'ascii');

const REASON_PHRASES: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  400: 'Bad Request',
  403: 'Forbidden',
  404: 'Not Found',
  500: 'Internal Server Error',
};

export interface RawRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | undefined;
}

export interface RawResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

export type Dispatch = (request: RawRequest) => Promise<RawResponse>;

export interface ServerHandle {
  port: number;
  close: () => Promise<void>;
}

export function parseHead(head: string): {
  method: string;
  path: string;
  httpVersion: string;
  headers: Record<string, string>;
} {
  const lines = head.split(CRLF);
  const requestLine = lines[0] || '';
  const [method = '', path = '', httpVersion = ''] = requestLine.split(' ');
  const headers: Record<string, string> = {};

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];

    if (line === '') continue;

    const colon = line.indexOf(':');

    if (colon === -1) continue;

    const key = line.slice(0, colon).trim().toLowerCase();

    headers[key] = line.slice(colon + 1).trim();
  }

  return { method, path, httpVersion, headers };
}

export function isChunked(headers: Record<string, string>): boolean {
  return (headers['transfer-encoding'] ?? '')
    .toLowerCase()
    .split(',')
    .map((token) => token.trim())
    .includes('chunked');
}

export function decodeChunked(buf: Buffer): Buffer | null {
  const parts: Buffer[] = [];
  let offset = 0;

  for (;;) {
    const lineEnd = buf.indexOf(CRLF, offset);

    if (lineEnd === -1) return null;

    const sizeToken = buf.subarray(offset, lineEnd).toString('ascii').split(';')[0].trim();
    const size = Number.parseInt(sizeToken, 16);

    if (Number.isNaN(size) || size < 0) throw new Error('invalid chunk size');

    const dataStart = lineEnd + CRLF.length;

    if (size === 0) {
      return buf.indexOf(CRLF, dataStart) === -1 ? null : Buffer.concat(parts);
    }

    const dataEnd = dataStart + size;

    if (buf.length < dataEnd + CRLF.length) return null;

    parts.push(buf.subarray(dataStart, dataEnd));
    offset = dataEnd + CRLF.length;
  }
}

const RESERVED_HEADERS = new Set(['content-type', 'content-length', 'connection']);

export function buildResponse(response: RawResponse): Buffer {
  const reason = REASON_PHRASES[response.status] ?? 'OK';
  const payload = response.body === undefined ? '' : JSON.stringify(response.body);
  const bodyBuffer = Buffer.from(payload, 'utf-8');

  let head =
    `HTTP/1.1 ${response.status} ${reason}${CRLF}` +
    `Content-Type: application/json${CRLF}` +
    `Content-Length: ${bodyBuffer.length}${CRLF}` +
    `Connection: close${CRLF}`;

  for (const [key, value] of Object.entries(response.headers ?? {})) {
    if (RESERVED_HEADERS.has(key.toLowerCase())) continue;

    head += `${key}: ${value}${CRLF}`;
  }

  head += CRLF;

  return Buffer.concat([Buffer.from(head, 'utf-8'), bodyBuffer]);
}

export function createConnectionHandler(
  dispatch: Dispatch,
  onError?: (error: Error) => void,
): (socket: net.Socket) => void {
  return (socket) => {
    let buffer = Buffer.alloc(0);

    const onData = (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);

      const separator = buffer.indexOf(HEADER_END);

      if (separator === -1) return;

      const headText = buffer.subarray(0, separator).toString('utf-8');
      const parsed = parseHead(headText);
      const bodyStart = separator + HEADER_END.length;

      let body: string | undefined;

      if (isChunked(parsed.headers)) {
        let decoded: Buffer | null;

        try {
          decoded = decodeChunked(buffer.subarray(bodyStart));
        } catch {
          socket.removeListener('data', onData);
          socket.end(
            buildResponse({
              status: 400,
              body: { statusCode: 400, message: 'Malformed chunked body' },
            }),
          );

          return;
        }

        if (decoded === null) return;

        body = decoded.length > 0 ? decoded.toString('utf-8') : undefined;
      } else {
        const contentLength = Number(parsed.headers['content-length'] ?? '0') || 0;
        const bodyReceived = buffer.length - bodyStart;

        if (bodyReceived < contentLength) return;

        body =
          contentLength > 0
            ? buffer.subarray(bodyStart, bodyStart + contentLength).toString('utf-8')
            : undefined;
      }

      socket.removeListener('data', onData);

      const request: RawRequest = {
        method: parsed.method,
        url: parsed.path,
        headers: parsed.headers,
        body,
      };

      dispatch(request)
        .then((response) => socket.end(buildResponse(response)))
        .catch((error: Error) => {
          onError?.(error);
          socket.end(
            buildResponse({
              status: 500,
              body: { statusCode: 500, message: 'Internal Server Error' },
            }),
          );
        });
    };

    socket.on('data', onData);
    socket.on('error', (error) => onError?.(error));
  };
}

export function listen(port: number, dispatch: Dispatch): Promise<ServerHandle> {
  return start(net.createServer(createConnectionHandler(dispatch)), port);
}

export function listenTls(
  port: number,
  options: tls.TlsOptions,
  dispatch: Dispatch,
): Promise<ServerHandle> {
  return start(tls.createServer(options, createConnectionHandler(dispatch)), port);
}

function start(server: net.Server, port: number): Promise<ServerHandle> {
  return new Promise((resolve) => {
    server.listen(port, () => {
      const address = server.address() as AddressInfo;

      resolve({
        port: address.port,
        close: () =>
          new Promise<void>((res, rej) => {
            (server as { closeAllConnections?: () => void }).closeAllConnections?.();
            server.close((error) => (error ? rej(error) : res()));
          }),
      });
    });
  });
}