import 'reflect-metadata';

import { z } from 'zod';

import { Injectable } from '../decorators/injectable';
import { ValidationError } from '../errors';
import type { PipeMetadata, PipeTransform } from '../lifecycle/contracts';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, meta: PipeMetadata): unknown {
    const schema = meta.schema as z.ZodType | undefined;

    if (!schema) return value;

    const result = schema.safeParse(value);

    if (!result.success) {
      const fields = result.error.issues.map((issue) => ({
        field: issue.path.map(String).join('.') || '(root)',
        message: issue.message,
      }));

      throw new ValidationError(fields);
    }

    return result.data;
  }
}