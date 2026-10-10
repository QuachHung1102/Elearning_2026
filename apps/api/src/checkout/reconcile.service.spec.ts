import { config } from '../config.js';
import { ReconcileService } from './reconcile.service.js';

// The loop itself, without a database: it must fire on the configured interval,
// survive a run that fails, and stop when the module is destroyed.
describe('ReconcileService loop', () => {
  const unusedDependencies = [null, null, null, null] as never[];

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function service() {
    const instance = new ReconcileService(
      ...(unusedDependencies as [never, never, never, never]),
    );
    const run = vi
      .spyOn(instance, 'runOnce')
      .mockResolvedValue({ confirmed: 0, failed: 0, expired: 0, cancelled: 0 });
    return { instance, run };
  }

  it('runs once per RECONCILE_INTERVAL and stops on destroy', () => {
    vi.useFakeTimers();
    const { instance, run } = service();
    const everyMs = config.reconcileIntervalSeconds * 1_000;

    instance.onModuleInit();
    vi.advanceTimersByTime(everyMs - 1);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(everyMs);
    expect(run).toHaveBeenCalledTimes(2);

    instance.onModuleDestroy();
    vi.advanceTimersByTime(10 * everyMs);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('keeps ticking after a run throws, and reports the failure on stderr', async () => {
    vi.useFakeTimers();
    const { instance, run } = service();
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    run.mockRejectedValueOnce(new Error('database is down'));
    const everyMs = config.reconcileIntervalSeconds * 1_000;

    instance.onModuleInit();
    await vi.advanceTimersByTimeAsync(everyMs);
    await vi.advanceTimersByTimeAsync(everyMs);

    expect(run).toHaveBeenCalledTimes(2);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('reconcile.run_failed'));
    instance.onModuleDestroy();
  });

  it('does not let the timer keep the process alive', () => {
    vi.useFakeTimers();
    const { instance } = service();
    const unref = vi.spyOn(globalThis, 'setInterval');

    instance.onModuleInit();

    const timer = unref.mock.results[0].value as { hasRef: () => boolean };
    expect(timer.hasRef()).toBe(false);
    instance.onModuleDestroy();
  });
});
