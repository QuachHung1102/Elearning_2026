/**
 * Settings that exist for the tests and would weaken a real deployment: none of
 * them may be present, whatever their value, when the environment is production.
 */
export function assertNoTestSettingsInProduction(env: NodeJS.ProcessEnv): void {
  if (isProductionEnv(env) && env.PASSWORD_HASH_COST !== undefined) {
    throw new Error(
      'Refusing to boot in production with PASSWORD_HASH_COST set: it weakens password hashing',
    );
  }
}

/**
 * The one answer to "is this production?" for everything that must not be lax
 * there: the boot guard, the cookie `Secure` flag, HSTS and the seed.
 */
export function isProductionEnv(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === 'production';
}
