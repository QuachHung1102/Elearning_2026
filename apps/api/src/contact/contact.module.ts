import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MailModule } from '../mail/mail.module.js';
import { ContactController } from './contact.controller.js';

@Module({
  imports: [AuthModule, MailModule],
  controllers: [ContactController],
})
export class ContactModule {}
