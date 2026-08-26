import { HttpException } from './http-exception';

export interface ValidationField {
  field: string;
  message: string;
}

export class NotFoundError extends Error {
  constructor(message = 'Not Found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(
    readonly fields: ValidationField[],
    message = 'Validation failed',
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ForbiddenException extends HttpException {
  constructor(message = 'Forbidden') {
    super(403, { statusCode: 403, message });
    this.name = 'ForbiddenException';
  }
}