import type { CookieOptions } from 'express';
import { config } from '../config.js';

export const AUTH_COOKIE_NAME = 'elearning_session';
export const CSRF_COOKIE_NAME = 'elearning_csrf';
export const CSRF_HEADER_NAME = 'x-csrf-token';
export const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60;

const BASE_COOKIE_OPTIONS: CookieOptions = {
  secure: config.nodeEnv === 'production',
  sameSite: 'lax',
  path: '/',
};

export const AUTH_COOKIE_OPTIONS: CookieOptions = {
  ...BASE_COOKIE_OPTIONS,
  httpOnly: true,
};

export const CSRF_COOKIE_OPTIONS: CookieOptions = {
  ...BASE_COOKIE_OPTIONS,
  httpOnly: false,
};
