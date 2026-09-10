import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { AuthRateLimitGuard } from '../auth/auth-rate-limit.guard.js';
import { RateLimit } from '../auth/rate-limit.decorator.js';
import { config } from '../config.js';
import { escapeHtml, MAILER, type Mailer } from '../mail/mailer.js';

class ContactDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 80)
  name: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @MaxLength(320)
  email: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(10, 2000)
  message: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]{3,120}$/)
  courseSlug?: string;
}

@Controller('contact')
export class ContactController {
  constructor(@Inject(MAILER) private readonly mailer: Mailer) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @RateLimit({ key: 'ip', limit: 3, windowSeconds: 60 })
  @UseGuards(AuthRateLimitGuard)
  async send(@Body() input: ContactDto): Promise<void> {
    const course = input.courseSlug
      ? `<p><strong>Khóa học:</strong> ${escapeHtml(input.courseSlug)}</p>`
      : '';
    await this.mailer.send({
      to: config.mailFrom,
      subject: `Liên hệ mới từ ${input.name}`,
      text: `Tên: ${input.name}\nEmail: ${input.email}${input.courseSlug ? `\nKhóa học: ${input.courseSlug}` : ''}\n\n${input.message}`,
      html: `<!doctype html><html lang="vi"><body><p><strong>Tên:</strong> ${escapeHtml(input.name)}</p><p><strong>Email:</strong> ${escapeHtml(input.email)}</p>${course}<p>${escapeHtml(input.message).replace(/\n/g, '<br>')}</p></body></html>`,
      tag: 'contact',
    });
  }
}
