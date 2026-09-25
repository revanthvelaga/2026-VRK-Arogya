import { MinLength } from 'class-validator';

export class ResetStaffPasswordDto {
  @MinLength(6)
  password: string;
}
