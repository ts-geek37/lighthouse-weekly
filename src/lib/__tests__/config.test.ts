import { loadConfig, AppConfig } from '../config';

describe('loadConfig', () => {
  // Save and restore process.env around each test to prevent pollution
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Clear all relevant env vars before each test
    delete process.env.DATABASE_URL;
    delete process.env.GROQ_API_KEY;
    delete process.env.REPORT_OUTPUT_DIR;
    delete process.env.AUDIT_SCHEDULE;
    delete process.env.MARKDOWN_OUTPUT_ENABLED;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // Helper to set all required vars
  const setRequiredVars = (overrides: Partial<Record<string, string>> = {}) => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
    process.env.GROQ_API_KEY = 'gsk_test_key_abc123';
    process.env.REPORT_OUTPUT_DIR = './reports';
    Object.assign(process.env, overrides);
  }

  describe('when all required vars are present', () => {
    it('returns a valid AppConfig with correct values', () => {
      setRequiredVars();

      const config: AppConfig = loadConfig();

      expect(config.databaseUrl).toBe('postgresql://user:pass@localhost:5432/testdb');
      expect(config.groqApiKey).toBe('gsk_test_key_abc123');
      expect(config.reportOutputDir).toBe('./reports');
    });

    it('uses default auditSchedule when AUDIT_SCHEDULE is not set', () => {
      setRequiredVars();

      const config = loadConfig();

      expect(config.auditSchedule).toBe('0 6 * * 1');
    });

    it('uses provided AUDIT_SCHEDULE when set', () => {
      setRequiredVars({ AUDIT_SCHEDULE: '0 8 * * 2' });

      const config = loadConfig();

      expect(config.auditSchedule).toBe('0 8 * * 2');
    });
  });

  describe('missing required variables', () => {
    it('throws when DATABASE_URL is missing and error message contains "DATABASE_URL"', () => {
      setRequiredVars();
      delete process.env.DATABASE_URL;

      expect(() => loadConfig()).toThrow(expect.objectContaining({
        message: expect.stringContaining('DATABASE_URL'),
      }));
    });

    it('throws when GROQ_API_KEY is missing and error message contains "GROQ_API_KEY"', () => {
      setRequiredVars();
      delete process.env.GROQ_API_KEY;

      expect(() => loadConfig()).toThrow(expect.objectContaining({
        message: expect.stringContaining('GROQ_API_KEY'),
      }));
    });

    it('throws when REPORT_OUTPUT_DIR is missing and error message contains "REPORT_OUTPUT_DIR"', () => {
      setRequiredVars();
      delete process.env.REPORT_OUTPUT_DIR;

      expect(() => loadConfig()).toThrow(expect.objectContaining({
        message: expect.stringContaining('REPORT_OUTPUT_DIR'),
      }));
    });

    it('throws when multiple vars are missing and all missing names appear in the error message', () => {
      // All three required vars are absent (cleared in beforeEach)

      let errorMessage = '';
      try {
        loadConfig();
      } catch (err) {
        errorMessage = (err as Error).message;
      }

      expect(errorMessage).toContain('DATABASE_URL');
      expect(errorMessage).toContain('GROQ_API_KEY');
      expect(errorMessage).toContain('REPORT_OUTPUT_DIR');
    });
  });

  describe('MARKDOWN_OUTPUT_ENABLED', () => {
    it('sets markdownOutputEnabled to true when MARKDOWN_OUTPUT_ENABLED=true', () => {
      setRequiredVars({ MARKDOWN_OUTPUT_ENABLED: 'true' });

      const config = loadConfig();

      expect(config.markdownOutputEnabled).toBe(true);
    });

    it('defaults markdownOutputEnabled to false when MARKDOWN_OUTPUT_ENABLED is absent', () => {
      setRequiredVars();
      // MARKDOWN_OUTPUT_ENABLED is not set (cleared in beforeEach)

      const config = loadConfig();

      expect(config.markdownOutputEnabled).toBe(false);
    });

    it('sets markdownOutputEnabled to false for any value other than "true"', () => {
      setRequiredVars({ MARKDOWN_OUTPUT_ENABLED: 'false' });

      const config = loadConfig();

      expect(config.markdownOutputEnabled).toBe(false);
    });
  });

  describe('secret value protection', () => {
    it('error message does NOT contain the value of DATABASE_URL when GROQ_API_KEY is missing', () => {
      const secretDbUrl = 'postgresql://secretuser:secretpass@db.example.com:5432/prod';
      setRequiredVars({ DATABASE_URL: secretDbUrl });
      delete process.env.GROQ_API_KEY;

      let errorMessage = '';
      try {
        loadConfig();
      } catch (err) {
        errorMessage = (err as Error).message;
      }

      expect(errorMessage).not.toContain('secretuser');
      expect(errorMessage).not.toContain('secretpass');
      expect(errorMessage).not.toContain(secretDbUrl);
    });

    it('error message does NOT contain the value of GROQ_API_KEY when DATABASE_URL is missing', () => {
      const secretApiKey = 'gsk_super_secret_key_xyz789';
      setRequiredVars({ GROQ_API_KEY: secretApiKey });
      delete process.env.DATABASE_URL;

      let errorMessage = '';
      try {
        loadConfig();
      } catch (err) {
        errorMessage = (err as Error).message;
      }

      expect(errorMessage).not.toContain(secretApiKey);
    });
  });
});
