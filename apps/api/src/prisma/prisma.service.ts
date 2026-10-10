import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from '../config.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { PG_SESSION_OPTIONS } from './pg-session.js';

/** Typed as well as configured: a query that reads the hash without asking for it does not compile. */
const OMIT = { user: { passwordHash: true } } as const;

@Injectable()
export class PrismaService
  extends PrismaClient<{ adapter: PrismaPg; omit: typeof OMIT }>
  implements OnModuleDestroy
{
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: config.databaseUrl,
        ...PG_SESSION_OPTIONS,
      }),
      // The password hash stays in the database unless a query asks for it
      // (API_CONTRACT.md §6.2): `omit: { passwordHash: false }` in `login` and
      // `changePassword`, which check a password, and nowhere else.
      omit: OMIT,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
