import { Controller, Get, Header, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async check(@Res({ passthrough: true }) response: Response) {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Database timeout')),
            2_000,
          );
        }),
      ]);
      return {
        status: 'ok',
        database: 'up',
        uptimeSeconds: Math.floor(process.uptime()),
      };
    } catch {
      response.status(503);
      return {
        status: 'degraded',
        database: 'down',
        uptimeSeconds: Math.floor(process.uptime()),
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
