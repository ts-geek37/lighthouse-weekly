import {
  validateProjectUrls,
  validateProjectFields,
  validateProjectSubmission,
} from '../project';

// ─── URL Validation ───────────────────────────────────────────────────────────

describe('validateProjectUrls', () => {
  describe('valid URLs', () => {
    it('accepts a valid http:// URL', () => {
      const result = validateProjectUrls(['http://example.com']);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts a valid https:// URL', () => {
      const result = validateProjectUrls(['https://example.com/path?q=1']);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts exactly 5 URLs', () => {
      const urls = [
        'https://example.com/1',
        'https://example.com/2',
        'https://example.com/3',
        'https://example.com/4',
        'https://example.com/5',
      ];
      const result = validateProjectUrls(urls);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('invalid protocol', () => {
    it('rejects an ftp:// URL with "Invalid URL" error', () => {
      const result = validateProjectUrls(['ftp://example.com']);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid URL: ftp://example.com');
    });

    it('rejects a relative path /about', () => {
      const result = validateProjectUrls(['/about']);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid URL: /about');
    });

    it('rejects an empty string', () => {
      const result = validateProjectUrls(['']);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid URL: ');
    });
  });

  describe('URL count limit', () => {
    it('rejects 6 URLs with "Maximum 5 URLs" error', () => {
      const urls = [
        'https://example.com/1',
        'https://example.com/2',
        'https://example.com/3',
        'https://example.com/4',
        'https://example.com/5',
        'https://example.com/6',
      ];
      const result = validateProjectUrls(urls);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Maximum 5 URLs allowed per project');
    });
  });

  describe('duplicate URLs', () => {
    it('rejects the same URL submitted twice', () => {
      const result = validateProjectUrls([
        'https://example.com',
        'https://example.com',
      ]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Duplicate URL: https://example.com');
    });

    it('rejects case-insensitive duplicates (HTTP://EXAMPLE.COM vs http://example.com)', () => {
      const result = validateProjectUrls([
        'http://example.com',
        'HTTP://EXAMPLE.COM',
      ]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Duplicate URL: HTTP://EXAMPLE.COM');
    });
  });
});

// ─── Field Validation ─────────────────────────────────────────────────────────

describe('validateProjectFields', () => {
  describe('valid fields', () => {
    it('passes when all required fields are present and valid', () => {
      const result = validateProjectFields({
        title: 'My Project',
        owner: 'Alice',
        environment: 'Production',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('passes with environment = "Production"', () => {
      const result = validateProjectFields({
        title: 'T',
        owner: 'O',
        environment: 'Production',
      });
      expect(result.valid).toBe(true);
    });

    it('passes with environment = "Staging"', () => {
      const result = validateProjectFields({
        title: 'T',
        owner: 'O',
        environment: 'Staging',
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('missing or empty title', () => {
    it('fails when title is missing', () => {
      const result = validateProjectFields({ owner: 'Alice', environment: 'Production' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('title is required');
    });

    it('fails when title is whitespace-only', () => {
      const result = validateProjectFields({
        title: '   ',
        owner: 'Alice',
        environment: 'Production',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('title is required');
    });
  });

  describe('missing owner', () => {
    it('fails when owner is missing', () => {
      const result = validateProjectFields({ title: 'My Project', environment: 'Production' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('owner is required');
    });
  });

  describe('missing or invalid environment', () => {
    it('fails when environment is missing', () => {
      const result = validateProjectFields({ title: 'My Project', owner: 'Alice' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('environment is required');
    });

    it('fails when environment is lowercase "production"', () => {
      const result = validateProjectFields({
        title: 'My Project',
        owner: 'Alice',
        environment: 'production',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("environment must be 'Production' or 'Staging'");
    });

    it('fails when environment is an arbitrary invalid value', () => {
      const result = validateProjectFields({
        title: 'My Project',
        owner: 'Alice',
        environment: 'invalid',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("environment must be 'Production' or 'Staging'");
    });
  });
});

// ─── Combined Validation ──────────────────────────────────────────────────────

describe('validateProjectSubmission', () => {
  it('passes for a fully valid submission', () => {
    const result = validateProjectSubmission({
      title: 'My Project',
      owner: 'Alice',
      environment: 'Production',
      urls: [{ url: 'https://example.com' }],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns all errors when both URLs and fields are invalid', () => {
    const result = validateProjectSubmission({
      // missing title and owner
      environment: 'bad-env',
      urls: [{ url: 'ftp://bad.com' }, { url: 'ftp://bad.com' }],
    });
    expect(result.valid).toBe(false);
    // Field errors
    expect(result.errors).toContain('title is required');
    expect(result.errors).toContain('owner is required');
    expect(result.errors).toContain("environment must be 'Production' or 'Staging'");
    // URL errors
    expect(result.errors).toContain('Invalid URL: ftp://bad.com');
    expect(result.errors).toContain('Duplicate URL: ftp://bad.com');
  });
});
