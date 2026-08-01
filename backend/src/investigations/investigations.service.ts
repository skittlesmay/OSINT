import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateInvestigationDto } from './dto/create-investigation.dto';

@Injectable()
export class InvestigationsService {
  constructor(
    private _prismaService: PrismaService,
    @Inject('OSINT_SERVICE') private _rmqClient: ClientProxy,
  ) {}

  async start(dto: CreateInvestigationDto) {
    const investigation = await this._prismaService.investigation.create({
      data: { target: dto.target, type: dto.type },
    });

    this._rmqClient.emit('search.start', {
      investigationId: investigation.id,
      target: investigation.target,
      type: investigation.type,
    });
    console.log(investigation);
    return investigation;
  }

  getStatus(id: string) {
    return this._prismaService.investigation.findUnique({
      where: { id },
      include: { artifacts: true },
    });
  }

  async toggleMonitoring(id: string) {
    const current = await this._prismaService.investigation.findUnique({
      where: {
        id,
      },
    });

    if (!current) {
      throw new NotFoundException('Расследование не найденно!');
    }

    return this._prismaService.investigation.update({
      where: {
        id,
      },
      data: {
        isMonitoring: !current.isMonitoring,
      },
    });
  }
}
