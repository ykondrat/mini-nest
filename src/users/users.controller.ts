import 'reflect-metadata';

import { Controller } from '../decorators/controller';
import { Get, Post } from '../decorators/methods';
import { Body, Param, Query } from '../decorators/params';
import { UsersService } from './users.service';
import { CreateUserDto } from '../dto/create-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query('limit') limit: string) {
    return this.users.list(Number(limit ?? '10'));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.users.findOne(Number(id));
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }
}