import { isProductionEnv } from './production.js';

export const REAL_DRIVER = {
  VIDEO_DRIVER: 'cloudflare',
  STORAGE_DRIVER: 'r2',
  MAIL_DRIVER: 'smtp',
  PAYMENT_DRIVER: 'zalopay',
} as const;

const DEMO_DRIVER = {
  VIDEO_DRIVER: 'demo',
  STORAGE_DRIVER: 'demo',
  MAIL_DRIVER: 'demo',
  PAYMENT_DRIVER: 'demo',
} as const;

type DriverName = keyof typeof REAL_DRIVER;
const DRIVER_NAMES = Object.keys(REAL_DRIVER) as DriverName[];

export function assertDriverValuesAreKnown(
  env: NodeJS.ProcessEnv,
): void {
  for (const name of DRIVER_NAMES) {
    const value = env[name];
    if (value === undefined) continue;
    if (value !== REAL_DRIVER[name] && value !== DEMO_DRIVER[name]) {
      throw new Error(
        `${name}="${value}" is not a valid driver. Expected "${DEMO_DRIVER[name]}" or "${REAL_DRIVER[name]}".`,
      );
    }
  }
}

export function assertNoDemoDriversInProduction(
  env: NodeJS.ProcessEnv,
): void {
  if (!isProductionEnv(env)) return;

  const demo = DRIVER_NAMES.filter((name) => env[name] !== REAL_DRIVER[name]);
  if (demo.length > 0) {
    throw new Error(
      `Refusing to boot in production with demo drivers: ${demo.join(', ')}`,
    );
  }
}
