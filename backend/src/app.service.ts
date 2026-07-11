import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import axios from 'axios';
import { load } from 'cheerio';

@Injectable()
export class AppService {
  constructor(private _prismaService: PrismaService) {}
  private readonly _logger = new Logger(AppService.name);

  async scrapeUsername(investigationId: string, target: string) {
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
            }

            if (location) {
              artifactsData.locationInfo = location;
            }

            if (bio) {
              artifactsData.bioInfo = bio;
            }
          }

          await this._prismaService.artifact.create({
            data: {
              investigationId,
              source: site.source,
              data: artifactsData,
            },
          });
          this._logger.debug('Профиль успешно найден!', artifactsData);
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
        continue;
      }
    }
  }
}
