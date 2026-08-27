import 'reflect-metadata';

import { Injectable } from '../decorators/injectable';
import { requestContext } from '../context/request-context';

@Injectable()
export class RequestLogger {
  log(message: string): string {
    const requestId = requestContext.getStore()?.requestId ?? 'no-context';

    console.log(`[${requestId}] ${message}`);

    return requestId;
  }
}