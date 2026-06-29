import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class CreateInvestigationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  target: string;
  @ApiProperty()
  @IsString()
  @IsIn(['USERNAME', 'EMAIL', 'PHONE'])
  type: string;
}
