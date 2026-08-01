import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { ScheduleModule } from '@nestjs/schedule';
import { AppService } from 'src/app.service';
import { InvestigationsGateway } from 'src/investigations/investigations.gateway';
import { Neo4jService } from 'src/neo4j/neo4j.service';

@Module({
  providers: [TasksService, AppService, InvestigationsGateway, Neo4jService],
  imports: [ScheduleModule.forRoot()],
})
export class TasksModule {}
