import { Controller } from '@nestjs/common';
import { AppService } from './app.service';
import { EventPattern, Payload } from '@nestjs/microservices';

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
}
