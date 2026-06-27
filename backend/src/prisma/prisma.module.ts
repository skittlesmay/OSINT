import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PrismaController } from './prisma.controller';

@Module({
  controllers: [PrismaController],
  providers: [PrismaService],
})
export class PrismaModule {}
