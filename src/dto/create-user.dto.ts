import { IsEmail, IsString, MinLength } from 'class-validator'; // декоратори-правила

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  name!: string;
}