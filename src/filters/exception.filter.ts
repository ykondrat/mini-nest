import { HttpException } from '../http-exception';
import { NotFoundError, ValidationError } from '../errors';
import type { ExceptionFilter, ExecutionContext } from '../lifecycle/contracts';
import type { RawResponse } from '../server/http-server';

const INTERNAL_ERROR: RawResponse = {
  status: 500,
  body: { statusCode: 500, message: 'Internal Server Error' },
};

interface ErrorMapping {
  type: new (...args: any[]) => Error;
  toResponse: (error: Error) => RawResponse;
}

function on<T extends Error>(
  type: new (...args: any[]) => T,
  toResponse: (error: T) => RawResponse,
): ErrorMapping {
  return { type, toResponse: (error) => toResponse(error as T) };
}

const ERROR_MAP: ErrorMapping[] = [
  on(NotFoundError, (error) => ({
    status: 404,
    body: { statusCode: 404, message: error.message },
  })),
  on(ValidationError, (error) => ({
    status: 400,
    body: { statusCode: 400, message: 'Validation failed', errors: error.fields },
  })),
  on(HttpException, (error) => ({ status: error.status, body: error.body })),
];

export class DefaultExceptionFilter implements ExceptionFilter {
  catch(error: unknown): RawResponse {
    if (error instanceof Error) {
      const mapping = ERROR_MAP.find(({ type }) => error instanceof type);

      if (mapping) return mapping.toResponse(error);
    }

    return INTERNAL_ERROR;
  }
}

export function runFilters(
  filters: ExceptionFilter[],
  error: unknown,
  ctx?: ExecutionContext,
): RawResponse {
  for (const filter of filters) {
    const handled = filter.catch(error, ctx);

    if (handled) return handled;
  }

  return new DefaultExceptionFilter().catch(error);
}