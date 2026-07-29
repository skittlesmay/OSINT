import { Controller, Get, Param } from '@nestjs/common';
import { AppService } from './app.service';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ApiOperation } from '@nestjs/swagger';

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
  getReport(@Param('id') id: string) {
    return this.appService.getFullReport(id);
  }
}
