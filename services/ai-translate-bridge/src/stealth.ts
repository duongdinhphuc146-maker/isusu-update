import { Page, BrowserContext } from 'playwright';

export const STEALTH_LAUNCH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--disable-infobars',
  '--lang=vi-VN,vi,en-US,en',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-web-security',
  '--disable-features=IsolateOrigins,site-per-process',
  '--disable-site-isolation-trials'
];

export async function applyStealth(pageOrContext: Page | BrowserContext): Promise<void> {
  try {
    await pageOrContext.addInitScript(() => {
      // 1. Hide webdriver property on navigator
      try {
        const newProto = Object.getPrototypeOf(navigator);
        delete (newProto as any).webdriver;
      } catch (e) {}

      // 2. Mock chrome object with realistic API surfaces
      try {
        (window as any).chrome = {
          app: {
            isInstalled: false,
            InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
            RunningState: { CAN_RUN: 'can_run', CANNOT_RUN: 'cannot_run', RUNNING: 'running' }
          },
          csi: () => {},
          loadTimes: () => ({
            requestTime: Date.now() / 1000 - 1,
            startLoadTime: Date.now() / 1000 - 1,
            commitLoadTime: Date.now() / 1000 - 0.8,
            finishDocumentLoadTime: Date.now() / 1000 - 0.5,
            finishLoadTime: Date.now() / 1000 - 0.4,
            firstPaintTime: Date.now() / 1000 - 0.7,
            firstPaintAfterLoadTime: 0,
            navigationType: 'Other',
            wasAlternateProtocolAvailable: false,
            wasFetchedViaSpdy: false
          }),
          runtime: {
            OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' },
            OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
            PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
            PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
            PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
            RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' }
          }
        };
      } catch (e) {}

      // 3. Override languages
      try {
        Object.defineProperty(navigator, 'languages', {
          get: () => ['vi-VN', 'vi', 'en-US', 'en'],
          configurable: true
        });
      } catch (e) {}

      // 4. Override userAgentData
      try {
        Object.defineProperty(navigator, 'userAgentData', {
          get: () => ({
            brands: [
              { brand: 'Not(A:Brand', version: '99' },
              { brand: 'Google Chrome', version: '122' },
              { brand: 'Chromium', version: '122' }
            ],
            mobile: false,
            platform: 'Windows'
          }),
          configurable: true
        });
      } catch (e) {}

      // 5. Mock plugins to make navigator.plugins look authentic
      try {
        const makePlugin = (name: string, filename: string, description: string) => {
          const plugin = Object.create(Plugin.prototype);
          Object.defineProperties(plugin, {
            name: { get: () => name, enumerable: true },
            filename: { get: () => filename, enumerable: true },
            description: { get: () => description, enumerable: true },
            length: { get: () => 0, enumerable: true }
          });
          return plugin;
        };
        const pluginsList = [
          makePlugin('PDF Viewer', 'internal-pdf-viewer', 'Portable Document Format'),
          makePlugin('Chrome PDF Viewer', 'internal-pdf-viewer', 'Portable Document Format'),
          makePlugin('Chromium PDF Viewer', 'internal-pdf-viewer', 'Portable Document Format'),
          makePlugin('Microsoft Edge PDF Viewer', 'internal-pdf-viewer', 'Portable Document Format'),
          makePlugin('WebKit built-in PDF', 'internal-pdf-viewer', 'Portable Document Format')
        ];
        const pluginArray = Object.create(PluginArray.prototype);
        Object.defineProperties(pluginArray, {
          length: { get: () => pluginsList.length, enumerable: true },
          item: { value: (index: number) => pluginsList[index] },
          namedItem: { value: (name: string) => pluginsList.find(p => p.name === name) }
        });
        for (let i = 0; i < pluginsList.length; i++) {
          Object.defineProperty(pluginArray, i, { get: () => pluginsList[i], enumerable: true });
        }
        Object.defineProperty(navigator, 'plugins', {
          get: () => pluginArray,
          configurable: true
        });
      } catch (e) {}

      // 6. Set device memory and hardware concurrency
      try {
        Object.defineProperty(navigator, 'deviceMemory', { get: () => 8, configurable: true });
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8, configurable: true });
      } catch (e) {}

      // 7. Mock Permissions query
      try {
        const originalQuery = navigator.permissions.query;
        navigator.permissions.query = (parameters: any) => (
          parameters && parameters.name === 'notifications' ?
            Promise.resolve({
              state: Notification.permission,
              onchange: null
            } as any) :
            originalQuery(parameters)
        );
      } catch (e) {}

      // 8. Spoof WebGL vendor & renderer to bypass virtual machine/SwiftShader detection
      try {
        const spoofWebGL = (contextProto: any) => {
          const getParameter = contextProto.getParameter;
          contextProto.getParameter = function(parameter: number) {
            // UNMASKED_VENDOR_WEBGL (0x9245)
            if (parameter === 37445) {
              return 'Google Inc. (NVIDIA)';
            }
            // UNMASKED_RENDERER_WEBGL (0x9246)
            if (parameter === 37446) {
              return 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)';
            }
            return getParameter.apply(this, arguments);
          };
        };
        if ((window as any).WebGLRenderingContext) {
          spoofWebGL((window as any).WebGLRenderingContext.prototype);
        }
        if ((window as any).WebGL2RenderingContext) {
          spoofWebGL((window as any).WebGL2RenderingContext.prototype);
        }
      } catch (e) {}

      // 9. Window metrics matching real displays
      try {
        Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth || 1920, configurable: true });
        Object.defineProperty(window, 'outerHeight', { get: () => window.innerHeight || 1080, configurable: true });
      } catch (e) {}
    });
  } catch (error) {
    console.error('[STEALTH] Failed to apply page/context stealth initialization:', error);
  }
}
