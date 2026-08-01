import { Injectable, Logger } from '@nestjs/common';
import { AppService } from 'src/app.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class TasksService {
  private _logger = new Logger(TasksService.name);
  constructor(
    private _prismaService: PrismaService,
    private _appService: AppService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleMonitoring() {
    const targetsToMonitor = await this._prismaService.investigation.findMany({
      where: {
        isMonitoring: true,
      },
    });

    if (targetsToMonitor.length === 0) {
      return;
    }
    this._logger.log(
      `Запуск фонового мониторинга для ${targetsToMonitor.length} целей.`,
    );

    for (const target of targetsToMonitor) {
      await this._appService.scrapeUsername(target.id, target.target);
    }
  }
}
