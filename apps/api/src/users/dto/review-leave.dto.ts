import { IsIn } from 'class-validator';

export class ReviewLeaveDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status: 'APPROVED' | 'REJECTED';
}
