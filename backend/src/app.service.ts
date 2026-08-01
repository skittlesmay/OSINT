import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import axios from 'axios';
import { load } from 'cheerio';
import { InvestigationsGateway } from './investigations/investigations.gateway';
import { Neo4jService } from './neo4j/neo4j.service';
import dedent from 'dedent';
import { Response } from 'express';

@Injectable()
export class AppService {
  constructor(
    private _prismaService: PrismaService,
    private _osintGateway: InvestigationsGateway,
    private _neo4j: Neo4jService,
  ) {}
  private readonly _logger = new Logger(AppService.name);

  async scrapeUsername(investigationId: string, target: string) {
    await this._neo4j.write(
      'MERGE (i:Investigation {id: $id, target: $target, type: $type})',
      { id: investigationId, target, type: 'USERNAME' },
    );

    const targets = [
      {
        source: 'GITHUB',
        url: `https://github.com/${target}`,
        checkSelector: '.vcard-username',
      },
      {
        source: 'PASTEBIN',
        url: `https://pastebin.com/u/target`,
        checkSelector: '.user-info',
      },
      {
        source: 'STEAM_ID',
        url: `https://steamcommunity.com/id/${target}`,
        checkSelector: '.actual_persona_name',
      },
      {
        source: 'STEAM_PROFILE',
        url: `https://steamcommunity.com/profiles/${target}`,
        checkSelector: '.actual_persona_name',
      },
    ];

    const total = targets.length;
    let checkedCount = 0;

    for (const site of targets) {
      try {
        const response = await axios.post<{
          solution: { response: string };
          status: string;
        }>('http://localhost:8191/v1', {
          cmd: 'request.get',
          url: site.url,
          maxTimeout: 30000,
        });

        if (response.data.status !== 'ok') {
          continue;
        }

        const html = response.data.solution.response;
        const cheer = load(html);

        const isProfileExists = cheer(site.checkSelector).length > 0;

        if (isProfileExists) {
          const metaTitle = cheer('title').text().trim();

          const artifactsData: Record<string, any> = {
            status: 'FOUND',
            profileUrl: site.url,
            titleInfo: metaTitle,
            scrapedAt: new Date().toISOString(),
          };

          if (site.source === 'GITHUB') {
            const bio = cheer('.user-profile-bio').text().trim();
            const company = cheer('.p-org').text().trim();
            const location = cheer('.p-label').text().trim();

            if (company) {
              artifactsData.companyInfo = company;
              await this._neo4j.write(
                `
                MERGE(a:Account {source: $source, url: $url})
                MERGE(c:Company {companyName: $company})
                MERGE(a)-[:WORKED_IN]->(c) 
                `,
                {
                  source: site.source,
                  url: site.url,
                  company: company,
                },
              );
            }

            if (location) {
              artifactsData.locationInfo = location;
              await this._neo4j.write(
                `
              MERGE(a:Account {source: $source, url: $url})
              MERGE(l:Location {name: $locationName})
              MERGE(a)-[:LOCATED_IN]->(l)
              `,
                {
                  source: site.source,
                  url: site.url,
                  locationName: location,
                },
              );
            }

            if (bio) {
              artifactsData.bioInfo = bio;
              await this._neo4j.write(
                `
                MERGE(a:Account {source: $source, url: $url})
                MERGE(b:Bio {bioInformation: $bio})
                MERGE(a)-[:ACCOUNT_BIO]->(b)
                `,
                {
                  source: site.source,
                  url: site.url,
                  bio: bio,
                },
              );
            }
          }

          const artifact = await this._prismaService.artifact.create({
            data: {
              investigationId,
              source: site.source,
              data: artifactsData,
            },
          });
          await this._neo4j.write(
            `
              MATCH (i:Investigation {id: $investigationId})
              MERGE (a:Account {source: $source, url: $url})
              MERGE (i)-[:HAS_ACCOUNT]->(a)
            `,
            { investigationId, source: site.source, url: site.url },
          );
          this._logger.debug('Профиль успешно найден!', artifactsData);
          this._osintGateway.server
            .to(investigationId)
            .emit('artifact-found', artifact);
        } else {
          const emptyArtifactsData: Record<string, any> = {
            status: 'NOT_FOUND',
            profileUrl: site.url,
            checkedAt: new Date().toISOString(),
          };
          await this._prismaService.artifact.create({
            data: {
              investigationId,
              source: site.source,
              data: emptyArtifactsData,
            },
          });
          this._logger.debug('Профиль не найден!', emptyArtifactsData);
        }
      } catch (error) {
        this._logger.error(`Ошибка при запросе к ${site.source}`, error);

        const investigationFailed =
          await this._prismaService.investigation.update({
            where: {
              id: investigationId,
            },
            data: {
              status: 'FAILED',
            },
          });

        this._osintGateway.server
          .to(investigationId)
          .emit('investigation_failed', {
            investigation: investigationFailed,
            error: 'Error code 500',
          });

        return;
      } finally {
        checkedCount++;
        const checkedPercentage = Math.round((checkedCount / total) * 100);

        this._osintGateway.server
          .to(investigationId)
          .emit('investigation_progress', {
            checked: checkedCount,
            total: total,
            percentage: checkedPercentage,
          });
      }
    }
  }

  async getFullReport(
    investigationId: string,
    format?: string,
    download?: string,
    res?: Response,
  ) {
    const investigation = await this._prismaService.investigation.findUnique({
      where: { id: investigationId },
      include: { artifacts: true },
    });

    if (!investigation) {
      throw new NotFoundException('Расследование не найдено!');
    }

    const ext = format || 'json';

    const allowedFormats = ['md', 'json'];

    if (download === 'true' && res) {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="investigation-${investigation.target}.${ext}"`,
      );
    }

    if (format && !allowedFormats.includes(format)) {
      throw new BadRequestException(
        'Неподдерживаемый формат отчета. Допустимы: json, md,',
      );
    }

    const totalArtifacts = investigation?.artifacts.length;

    const foundArtifacts = investigation.artifacts.filter(
      (artifact) => (artifact.data as { status: string }).status === 'FOUND',
    );

    const foundCount = foundArtifacts.length;

    const notFoundCount = totalArtifacts - foundCount;

    const successRate =
      totalArtifacts > 0 ? Math.round((foundCount / totalArtifacts) * 100) : 0;

    const neo4jResult = await this._neo4j.write(
      `
      MATCH(i:Investigation {id: $id})-[r:HAS_ACCOUNT]->(a:Account)
      RETURN a.source AS source, a.url AS url
      `,
      {
        id: investigationId,
      },
    );

    const graphConnections = neo4jResult.records.map((record) => {
      return {
        source: record.get('source'),
        url: record.get('url'),
      };
    });

    if (format === 'md') {
      const profilesList = foundArtifacts
        .map(
          (a) =>
            `- **${a.source}:** *${(a.data as { profileUrl?: string })?.profileUrl || 'Ссылка отсутствует'}*`,
        )
        .join('\n');

      const graphList = graphConnections
        .map((g) => `- **${g.source}:** *${g.url}*`)
        .join('\n');

      return dedent`
        ### 🕵️ Досье расследования: ${investigation.target}

        - **ID:** ${investigation.id}
        - **Статус:** ${investigation.status}
        - **Успешность:** ${foundCount} из ${totalArtifacts} (${successRate}%)

        #### 🎯 Найденные профили (${foundCount})
        ${profilesList || '*Профили не найдены*'}

        #### 🌐 Сеть связей (Neo4j)
        ${graphList || '*Связи в графе отсутствуют*'}
  `;
    }

    return {
      summary: {
        id: investigation.id,
        target: investigation.target,
        status: investigation.status,
        createdAt: investigation.createdAt,
        sucсessRate: `${successRate}%`,
        totalProfilesArtifacts: totalArtifacts,
        profilesFound: foundCount,
        profilesNotFound: notFoundCount,
      },

      artifacts: investigation.artifacts,
      graphNetwork: graphConnections,
    };
  }
}
