import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { InvestigationsService } from './investigations.service';
import { InvestigationsController } from './investigations.controller';
import { InvestigationsGateway } from './investigations.gateway';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'OSINT_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://guest:guest@localhost:5672'],
          queue: 'investigations_queue',
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  controllers: [InvestigationsController],
  providers: [InvestigationsService, InvestigationsGateway],
  exports: [InvestigationsGateway],
})
export class InvestigationsModule {}
