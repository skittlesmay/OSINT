import { Body, Post, Get, Controller, Param, Patch } from '@nestjs/common';
import { InvestigationsService } from './investigations.service';
import { CreateInvestigationDto } from './dto/create-investigation.dto';
import { ApiOperation } from '@nestjs/swagger';

@Controller('investigations')
export class InvestigationsController {
  constructor(private readonly _investigationsService: InvestigationsService) {}

  @ApiOperation({ summary: 'Создание нового расследования' })
  @Post('start')
  startInvestigation(@Body() dto: CreateInvestigationDto) {
    return this._investigationsService.start(dto);
  }

  @ApiOperation({ summary: 'Получения статуса и артефактов по id из db' })
  @Get('status/:id')
  getStatusInvestigation(@Param('id') id: string) {
    return this._investigationsService.getStatus(id);
  }

  @ApiOperation({ summary: 'Включение и выключение мониторинга' })
  @Patch(':id/toggle-monitoring')
  toggleMonitoring(@Param('id') id: string) {
    return this._investigationsService.toggleMonitoring(id);
  }
}
