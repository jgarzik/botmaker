import { describe, it, expect } from 'vitest';
import { VENDOR_CONFIGS } from './types.js';

describe('VENDOR_CONFIGS', () => {
  it('should include grok vendor', () => {
    expect(VENDOR_CONFIGS.grok).toBeDefined();
  });

  it('grok vendor has correct host', () => {
    expect(VENDOR_CONFIGS.grok.host).toBe('api.x.ai');
  });

  it('grok vendor has correct basePath', () => {
    expect(VENDOR_CONFIGS.grok.basePath).toBe('/v1');
  });

  it('grok vendor uses Authorization header', () => {
    expect(VENDOR_CONFIGS.grok.authHeader).toBe('Authorization');
  });

  it('grok vendor authFormat produces Bearer token', () => {
    expect(VENDOR_CONFIGS.grok.authFormat('test-key')).toBe('Bearer test-key');
  });

  it('all static vendors have required fields', () => {
    for (const [name, config] of Object.entries(VENDOR_CONFIGS)) {
      expect(config.host, `${name}.host`).toBeTruthy();
      expect(config.basePath, `${name}.basePath`).toBeDefined();
      expect(config.authHeader, `${name}.authHeader`).toBeTruthy();
      expect(typeof config.authFormat, `${name}.authFormat`).toBe('function');
    }
  });
});
