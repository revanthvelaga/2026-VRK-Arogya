import { IsString, MaxLength } from 'class-validator';

export class CreateIssueDto {
  @IsString()
  @MaxLength(150)
  subject: string;

  @IsString()
  description: string;
}
