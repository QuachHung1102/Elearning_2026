import { readFile, readdir } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminGuard } from '../auth/admin.guard.js';
import { config } from '../config.js';
import { escapeHtml } from '../mail/mailer.js';

const ID = /^\d{13}-[0-9a-f]{12}$/;
const LINK = /https?:\/\/[^"'\s<>]*[?&]token=[A-Za-z0-9._~-]+/;

@Controller('dev/mail')
@UseGuards(AdminGuard)
export class DevMailController {
  @Get()
  async list(@Res() response: Response): Promise<void> {
    const directory = resolve(config.localMailDir);
    let names: string[];
    try {
      names = (await readdir(directory))
        .filter((name) => ID.test(name.replace(/\.eml$/, '')))
        .sort()
        .reverse()
        .slice(0, 50);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      names = [];
    }

    const rows = await Promise.all(
      names.map(async (name) => {
        const content = await readFile(resolve(directory, name), 'utf8');
        const headers = this.headers(content);
        const id = name.replace(/\.eml$/, '');
        const link = content.match(LINK)?.[0];
        return `<tr><td>${escapeHtml(headers.Date ?? '')}</td><td>${escapeHtml(headers['X-Elearning-Tag'] ?? '')}</td><td>${escapeHtml(headers.To ?? '')}</td><td>${escapeHtml(headers.Subject ?? '')}</td><td><a href="/api/v1/dev/mail/${id}">Xem thư</a>${link ? ` · <a href="${escapeHtml(link)}">Mở liên kết</a>` : ''}</td></tr>`;
      }),
    );

    response
      .type('html')
      .send(
        `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Hộp thư dev</title></head><body><h1>Hộp thư dev</h1><table><thead><tr><th>Thời gian</th><th>Loại</th><th>Người nhận</th><th>Tiêu đề</th><th>Hành động</th></tr></thead><tbody>${rows.join('')}</tbody></table></body></html>`,
      );
  }

  @Get(':id')
  async show(
    @Param('id') id: string,
    @Res() response: Response,
  ): Promise<void> {
    if (!ID.test(id)) throw new NotFoundException();
    const directory = resolve(config.localMailDir);
    const path = resolve(directory, `${id}.eml`);
    if (!path.startsWith(`${directory}${sep}`)) throw new NotFoundException();

    let content: string;
    try {
      content = await readFile(path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException();
      }
      throw error;
    }
    const body = content
      .split(/\r?\n\r?\n/)
      .slice(1)
      .join('\n\n');
    response.type('html').send(body);
  }

  private headers(content: string): Record<string, string> {
    return Object.fromEntries(
      content
        .split(/\r?\n\r?\n/, 1)[0]
        .split(/\r?\n/)
        .map((line) => line.split(/:\s*/, 2))
        .filter((parts) => parts.length === 2),
    );
  }
}
