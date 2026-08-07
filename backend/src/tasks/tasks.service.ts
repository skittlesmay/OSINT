import { Injectable, Logger } from '@nestjs/common';
import { AppService } from 'src/app.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class TasksService {
  private _logger = new Logger(TasksService.name);
  constructor(
    private _prismaService: PrismaService,
    private _appService: AppService,
  ) {}

  @Cron('0 */2 * * * *')
  async handleMonitoring() {
    const targetsToMonitor = await this._prismaService.investigation.findMany({
      where: { isMonitoring: true },
    });

    if (targetsToMonitor.length === 0) {
      return;
    }
    this._logger.log(
      `Запуск фонового мониторинга для ${targetsToMonitor.length} целей.`,
    );

    for (const target of targetsToMonitor) {
      if (target.monitoringCount >= 10) {
        await this._prismaService.investigation.update({
          where: { id: target.id },
          data: { isMonitoring: false },
        });
        this._logger.warn(
          `Достигнут лимит проверок (10) для цели ${target.target}. Мониторинг отключен!`,
        );
        continue;
      }

      try {
        target.monitoringCount += 1;
        await this._prismaService.investigation.update({
          where: { id: target.id },
          data: {
            lastMonitoredAt: new Date(),
            monitoringCount: { increment: 1 },
          },
        });
        await this._appService.scrapeUsername(target.id, target.target);
        this._logger.log(
          `Круг мониторинга для цели ${target.target} закончен. Статуc: ${target.status}, ID: ${target.id}`,
        );
      } catch (err) {
        console.error(err);
      }
    }
  }
}
