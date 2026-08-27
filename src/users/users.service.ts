import 'reflect-metadata';

import type { Pool } from 'pg';

import { Injectable } from '../decorators/injectable';
import { Inject } from '../decorators/inject';
import { DATABASE_POOL } from '../tokens';
import { HttpException } from '../http-exception';
import { NotFoundError } from '../errors';
import { CreateUserDto } from '../dto/create-user.dto';

export interface User {
  id: number;
  name: string;
  email: string;
}

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async list(limit: number): Promise<User[]> {
    const { rows } = await this.pool.query(
      'SELECT id, name, email FROM users ORDER BY id LIMIT $1',
      [limit],
    );

    return rows as User[];
  }

  async findOne(id: number): Promise<User> {
    const { rows } = await this.pool.query('SELECT id, name, email FROM users WHERE id = $1', [id]);

    if (rows.length === 0) {
      throw new NotFoundError(`User ${id} not found`);
    }

    return rows[0] as User;
  }

  async create(dto: CreateUserDto): Promise<User> {
    try {
      const { rows } = await this.pool.query(
        'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name, email',
        [dto.name, dto.email],
      );

      return rows[0] as User;
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new HttpException(409, { statusCode: 409, message: 'Email already exists' });
      }

      throw error;
    }
  }
}