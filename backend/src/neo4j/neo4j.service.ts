import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import neo4j, { Driver } from 'neo4j-driver';

@Injectable()
export class Neo4jService implements OnModuleInit, OnModuleDestroy {
  private _driver: Driver;

  constructor(private readonly _configServise: ConfigService) {}

  onModuleInit() {
    this._driver = neo4j.driver(
      this._configServise.getOrThrow('NEO4J_URL'),
      neo4j.auth.basic(
        this._configServise.getOrThrow('NEO4J_USER'),
        this._configServise.getOrThrow('NEO4J_PASSWORD'),
      ),
    );
  }

  async write(query: string, params?: Record<string, any>) {
    const session = this._driver.session();

    try {
      return await session.executeWrite((tx) => tx.run(query, params));
    } finally {
      await session.close();
    }
  }

  async onModuleDestroy() {
    await this._driver.close();
  }
}
