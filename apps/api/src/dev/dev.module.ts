import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DevMailController } from './dev-mail.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [DevMailController],
})
export class DevModule {}
