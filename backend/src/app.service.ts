import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import axios from 'axios';
import { load } from 'cheerio';

@Injectable()
export class AppService {
  constructor(private _prismaService: PrismaService) {}

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
    ];

    for (const site of targets) {
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

        await this._prismaService.artifact.create({
          data: {
            investigationId,
            source: site.source,
            data: {
              status: 'FOUND',
              profileUrl: site.url,
              titleInfo: metaTitle,
              scrapedAt: new Date().toISOString(),
            },
          },
        });
      } else {
        console.log('Профиль не найден!');
      }
    }
  }
}
