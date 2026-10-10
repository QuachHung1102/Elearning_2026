import { configureApp, noStoreForAdmin } from './app.setup.js';

function fakeApp() {
  return {
    disable: vi.fn(),
    setGlobalPrefix: vi.fn(),
    use: vi.fn(),
    useBodyParser: vi.fn(),
    useGlobalFilters: vi.fn(),
    useGlobalPipes: vi.fn(),
  };
}

const mountedPaths = (app: ReturnType<typeof fakeApp>) =>
  app.use.mock.calls.filter(([first]) => typeof first === 'string');

describe('configureApp raw upload parser (REVIEW F-09)', () => {
  it('buffers bodies under /media/local when that controller is registered', () => {
    const app = fakeApp();

    configureApp(app as never, { localFiles: true });

    expect(mountedPaths(app).map(([path]) => path)).toEqual([
      '/api/v1/media/local',
    ]);
  });

  it('mounts nothing there when the route does not exist, so an anonymous body is not buffered', () => {
    const app = fakeApp();

    configureApp(app as never, { localFiles: false });

    expect(mountedPaths(app)).toEqual([]);
  });
});

describe('configureApp HSTS default (REVIEW F-28)', () => {
  afterEach(() => {
    vi.doUnmock('./config.js');
    vi.resetModules();
  });

  /** Every header the app's middleware sets on one request, with `config` replaced. */
  async function headersFor(isProduction: boolean) {
    vi.resetModules();
    vi.doMock('./config.js', () => ({
      config: { isProduction, servesLocalFiles: false },
    }));
    const { configureApp: configure } = await import('./app.setup.js');
    const app = fakeApp();
    configure(app as never);

    const names: string[] = [];
    const request = { path: '/api/v1/health', headers: {}, get: () => undefined };
    const response = { setHeader: (name: string) => names.push(name) };
    for (const [middleware] of app.use.mock.calls) {
      if (typeof middleware === 'function') {
        (middleware as (...args: unknown[]) => void)(request, response, () => {});
      }
    }
    return names;
  }

  it('pins the browser to HTTPS when config says production, whatever NODE_ENV is', async () => {
    expect(await headersFor(true)).toContain('Strict-Transport-Security');
  });

  it('does not otherwise', async () => {
    expect(await headersFor(false)).not.toContain('Strict-Transport-Security');
  });
});

describe('noStoreForAdmin (REVIEW F-26)', () => {
  const run = (path: string) => {
    const setHeader = vi.fn();
    const next = vi.fn();
    noStoreForAdmin({ path } as never, { setHeader } as never, next);
    expect(next).toHaveBeenCalledOnce();
    return setHeader;
  };

  it.each(['/api/v1/admin/courses', '/API/V1/ADMIN/courses'])(
    'marks %s no-store whatever its case',
    (path) => {
      expect(run(path)).toHaveBeenCalledWith('Cache-Control', 'no-store');
    },
  );

  it('leaves public paths cacheable', () => {
    expect(run('/api/v1/courses')).not.toHaveBeenCalled();
  });
});
