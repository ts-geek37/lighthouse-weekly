// Shared validation rules for project creation and updates

/**
 * Validates an array of URL strings.
 * Checks for: max 5 URLs, valid absolute http/https URLs, no duplicates (case-insensitive).
 */
export function validateProjectUrls(urls: string[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Rule 1: Maximum 5 URLs
  if (urls.length > 5) {
    errors.push('Maximum 5 URLs allowed per project');
  }

  // Rule 2: Each URL must be a valid absolute http:// or https:// URL
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

  // Rule 3: No duplicate URLs (case-insensitive)
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
}

/**
 * Validates the required fields for a project.
 * Checks for: non-empty title, owner, environment; environment must be 'Production' or 'Staging'.
 */
export function validateProjectFields(fields: {
  title?: string;
  owner?: string;
  environment?: string;
  reportEmail?: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Rule 1: title is required and non-whitespace
  if (!fields.title || fields.title.trim() === '') {
    errors.push('title is required');
  }

  // Rule 2: owner is required and non-whitespace
  if (!fields.owner || fields.owner.trim() === '') {
    errors.push('owner is required');
  }

  // Rule 3: environment is required and non-whitespace
  if (!fields.environment || fields.environment.trim() === '') {
    errors.push('environment is required');
  } else if (fields.environment !== 'Production' && fields.environment !== 'Staging') {
    // Rule 4: environment must be 'Production' or 'Staging'
    errors.push("environment must be 'Production' or 'Staging'");
  }

  if (fields.reportEmail && fields.reportEmail.trim() !== '') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(fields.reportEmail.trim())) {
      errors.push('reportEmail must be a valid email address');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Combines field and URL validation for a full project submission.
 */
export function validateProjectSubmission(data: {
  title?: string;
  owner?: string;
  environment?: string;
  reportEmail?: string;
  urls?: Array<{ url: string }>;
}): { valid: boolean; errors: string[] } {
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
}
