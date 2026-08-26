import 'reflect-metadata';

import { Controller } from '../decorators/controller';
import { Get, Post } from '../decorators/methods';
import { Body, Param, Query } from '../decorators/params';
import { UseGuards } from '../decorators/use-guards';
import { AuthGuard } from '../guards/auth.guard';
import { UsersService } from './users.service';
import { GreetingService } from '../services/greeting.service';
import { CreateUserDto } from '../dto/create-user.dto';

@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly greeting: GreetingService,
  ) {}

  @Get()
  list(@Query('limit') limit: string) {
    return this.users.list(Number(limit ?? '10'));
  }

  @Get('hello/:name')
  hello(@Param('name') name: string) {
    return this.greeting.greet(name);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.users.findOne(Number(id));
  }

  @Post()
  @UseGuards(AuthGuard)
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }
}