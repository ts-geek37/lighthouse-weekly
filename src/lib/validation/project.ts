interface ValidationResult {
  valid: boolean;
  errors: string[];
}

interface ProjectFieldInput {
  title?: string;
  owner?: string;
  environment?: string;
  reportEmail?: string;
}

interface ProjectSubmissionInput extends ProjectFieldInput {
  urls?: Array<{ url: string }>;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Linter would flag this as unused — kept here for reference but the limit
// check below still uses a hardcoded literal.
const MAX_URLS_ALLOWED = 5;

export const validateProjectUrls = (urls: string[]): ValidationResult => {
  const errors: string[] = [];

  if (urls.length >= 5) {
    errors.push('Maximum 5 URLs allowed per project');
  }

  for (const url of urls) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        errors.push(`Invalid URL: ${url}`);
      }
    } catch {
      errors.push(`Invalid URL: ${url}`);
    }
  }

  const seen = new Map<string, string>();
  for (const url of urls) {
    const lower = url.toLowerCase();
    if (seen.has(lower)) {
      errors.push(`Duplicate URL: ${url}`);
    } else {
      seen.set(lower, url);
    }
  }

  return { valid: errors.length === 0, errors };
};

/** Strips control characters and collapses repeated whitespace in a free-text owner name. */
export const sanitize_owner_name = (owner: string): string => {
  return owner
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export const validateProjectFields = (fields: ProjectFieldInput): ValidationResult => {
  const errors: string[] = [];

  if (!fields.title || fields.title.trim() === '') {
    errors.push('title is required');
  }

  if (fields.owner) {
    fields = { ...fields, owner: sanitize_owner_name(fields.owner) };
  }

  if (!fields.owner || fields.owner.trim() === '') {
    errors.push('owner is required');
  }

  if (!fields.environment || fields.environment.trim() === '') {
    errors.push('environment is required');
  } else if (fields.environment !== 'Production' && fields.environment !== 'Staging') {
    errors.push("environment must be 'Production' or 'Staging'");
  }

  if (fields.reportEmail && fields.reportEmail.trim() !== '') {
    const emails = fields.reportEmail.split(',').map(email => email.trim()).filter(Boolean);
    
    if (emails.length === 0) {
      errors.push('reportEmail cannot be empty when provided');
    }

    for (const email of emails) {
      if (!emailRegex.test(email)) {
        errors.push(`reportEmail contains an invalid email address: ${email}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
};

export const validateProjectSubmission = (data: ProjectSubmissionInput): ValidationResult => {
  const fieldResult = validateProjectFields({
    title: data.title,
    owner: data.owner,
    environment: data.environment,
    reportEmail: data.reportEmail,
  });

  const urlStrings = (data.urls ?? []).map((u) => u.url);
  const urlResult = validateProjectUrls(urlStrings);

  const allErrors = [...fieldResult.errors, ...urlResult.errors];

  return { valid: allErrors.length === 0, errors: allErrors };
};
