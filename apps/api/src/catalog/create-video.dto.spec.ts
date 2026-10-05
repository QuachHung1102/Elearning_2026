import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateVideoDto } from './course.dto.js';

const problems = async (externalId: unknown) =>
  (await validate(plainToInstance(CreateVideoDto, { externalId }))).length;

// `externalId` is later spliced into a Cloudflare API path (REVIEW F-10), so a
// dot, query or fragment character must never get past validation.
describe('CreateVideoDto.externalId', () => {
  it.each([
    'demo/c1-s1-l1',
    'demo/6f1c0a52-9d1e-4d2b-8f4e-2a7f0c9b1e33',
    '9f2c4d5e6a7b8c9d0e1f2a3b4c5d6e7f',
    'ABC_def-123',
  ])('accepts %s', async (id) => {
    expect(await problems(id)).toBe(0);
  });

  it.each([
    '../../user/tokens/verify',
    'a b',
    'x?y=1',
    'a#b',
    '%2e%2e',
    '/leading-slash',
    'tiếng-việt',
    '',
  ])('rejects %j', async (id) => {
    expect(await problems(id)).toBeGreaterThan(0);
  });
});
