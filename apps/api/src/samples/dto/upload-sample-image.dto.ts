import { IsIn } from 'class-validator';
import { SampleImageKind } from '../entities/sample-image.entity';

export class UploadSampleImageDto {
  @IsIn(['COLLECTION', 'DROP_OFF'])
  kind: SampleImageKind;
}
