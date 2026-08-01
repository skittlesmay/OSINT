import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { InvestigationsModule } from './investigations/investigations.module';
import { Neo4jService } from './neo4j/neo4j.service';
import { Neo4jModule } from './neo4j/neo4j.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '../.env',
      isGlobal: true,
    }),
    PrismaModule,
    InvestigationsModule,
    Neo4jModule,
    TasksModule,
  ],
  controllers: [AppController],
  providers: [AppService, Neo4jService],
})
export class AppModule {}
