import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import type { Constructor } from '../tokens';
import { HttpException } from '../http-exception';
import { Injectable } from '../decorators/injectable';

export interface FieldError {
  field: string;
  constraints: string[];
}

@Injectable()
export class ValidationPipe {
  async transform(value: unknown, metatype: unknown): Promise<unknown> {
    if (!this.shouldValidate(metatype)) {
      return value;
    }

    const instance = plainToInstance(metatype, value ?? {});
    const errors = await validate(instance as object);

    if (errors.length > 0) {
      const fields: FieldError[] = errors.map((error) => ({
        field: error.property,
        constraints: Object.values(error.constraints ?? {}),
      }));

      throw new HttpException(400, {
        statusCode: 400,
        message: 'Validation failed',
        errors: fields,
      });
    }

    return instance;
  }

  private shouldValidate(metatype: unknown): metatype is Constructor {
    if (typeof metatype !== 'function') return false;

    const passthrough: unknown[] = [String, Number, Boolean, Array, Object];

    return !passthrough.includes(metatype);
  }
}