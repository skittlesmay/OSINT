import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @EventPattern('search.start')
  handleSearchStart(
    @Payload() data: { investigationId: string; target: string; type: string },
  ) {
    if (data.type !== 'USERNAME') {
      return;
    }
    void this.appService.scrapeUsername(data.investigationId, data.target);
  }

  @ApiOperation({
    summary: 'Получение полного отчета по investigation',
    description:
      'Собирает данные из postgresql (артефакты) и Neo4j (графовые связи аккаунтов) по id investigation',
  })
  @Get('investigations/:id/report')
  getReport(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
    @Query('format') format?: string,
  ) {
    if (format === 'md') {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    }
    return this.appService.getFullReport(id, format);
  }
}
