import 'reflect-metadata';

import { Injectable } from '../decorators/injectable';
import { RequestLogger } from './request-logger.service';

@Injectable()
export class GreetingService {
  constructor(private readonly logger: RequestLogger) {}

  greet(name: string): { message: string; requestId: string } {
    const requestId = this.logger.log(`greeting ${name}`);

    return { message: `hello ${name}`, requestId };
  }
}