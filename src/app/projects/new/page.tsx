'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

interface UrlEntry {
  url: string;
  pageType: string;
  priority: string;
}

interface ProjectCreateResponse {
  error?: string;
  details?: string[];
}

const PAGE_TYPES = ['homepage', 'login', 'signup', 'checkout', 'pricing', 'product', 'blog', 'other'] as const;
const PRIORITIES = ['high', 'medium', 'low'] as const;

const fieldClass = 'flex flex-col gap-1';
const labelClass = 'text-sm font-medium text-gray-700';
const inputClass = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const selectClass = inputClass;

const titleCase = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

const NewProjectPage = () => {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState('');
  const [priority, setPriority] = useState('medium');
  const [environment, setEnvironment] = useState('Production');
  const [reportEmail, setReportEmail] = useState('');
  const [urls, setUrls] = useState<UrlEntry[]>([{ url: '', pageType: 'homepage', priority: 'high' }]);

  const addUrl = () => {
    if (urls.length < 5) {
      setUrls(previous => [...previous, { url: '', pageType: 'homepage', priority: 'medium' }]);
    }
  };

  const removeUrl = (index: number) => {
    setUrls(previous => previous.filter((_, currentIndex) => currentIndex !== index));
  };

  const updateUrl = (index: number, field: keyof UrlEntry, value: string) => {
    setUrls(previous => previous.map((urlEntry, currentIndex) => (
      currentIndex === index ? { ...urlEntry, [field]: value } : urlEntry
    )));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrors([]);

    const payload = {
      title,
      description: description || undefined,
      owner,
      priority,
      environment,
      reportEmail: reportEmail || undefined,
      urls: urls.filter(urlEntry => urlEntry.url.trim() !== ''),
    };

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as ProjectCreateResponse;

      if (response.status === 201) {
        router.push('/projects');
      } else if (response.status === 422) {
        setErrors(data.details ?? [data.error ?? 'Validation failed']);
      } else {
        setErrors([data.error ?? 'An unexpected error occurred']);
      }
    } catch {
      setErrors(['Network error - please try again']);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6 sm:p-8">
      <div className="mb-6">
        <Link href="/projects" className="text-sm text-gray-500 no-underline hover:text-gray-800">
          ← Back to projects
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Add New Project</h1>
      </div>

      {errors.length > 0 && (
        <div className="mb-6 rounded-md border border-red-300 bg-red-100 p-4 text-sm text-red-800">
          <strong>Please fix the following errors:</strong>
          <ul className="mt-2 list-disc pl-5">
            {errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <section className="rounded-lg border border-gray-200 bg-gray-50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Project Details</h2>

          <div className="space-y-4">
            <div className={fieldClass}>
              <label className={labelClass}>Title <span className="text-red-500">*</span></label>
              <input className={inputClass} value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Main Marketing Site" required />
            </div>

            <div className={fieldClass}>
              <label className={labelClass}>Description</label>
              <textarea className={`${inputClass} min-h-20 resize-y`} value={description} onChange={event => setDescription(event.target.value)} placeholder="Optional description" />
            </div>

            <div className={fieldClass}>
              <label className={labelClass}>Report Email(s)</label>
              <input className={inputClass} type="text" value={reportEmail} onChange={event => setReportEmail(event.target.value)} placeholder="e.g. alerts@example.com, team@example.com (comma separated, optional)" />
              <span className="text-xs text-gray-500">Separate multiple email addresses with commas.</span>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className={fieldClass}>
                <label className={labelClass}>Owner / Team <span className="text-red-500">*</span></label>
                <input className={inputClass} value={owner} onChange={event => setOwner(event.target.value)} placeholder="e.g. Platform Team" required />
              </div>

              <div className={fieldClass}>
                <label className={labelClass}>Priority</label>
                <select className={selectClass} value={priority} onChange={event => setPriority(event.target.value)}>
                  {PRIORITIES.map(value => <option key={value} value={value}>{titleCase(value)}</option>)}
                </select>
              </div>

              <div className={fieldClass}>
                <label className={labelClass}>Environment <span className="text-red-500">*</span></label>
                <select className={selectClass} value={environment} onChange={event => setEnvironment(event.target.value)}>
                  <option value="Production">Production</option>
                  <option value="Staging">Staging</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-gray-50 p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="m-0 text-lg font-semibold text-gray-900">
              Monitored URLs <span className="text-sm font-normal text-gray-500">(up to 5)</span>
            </h2>
            {urls.length < 5 && (
              <button type="button" onClick={addUrl} className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm text-blue-600 transition hover:bg-blue-100">
                + Add URL
              </button>
            )}
          </div>

          <div className="space-y-4">
            {urls.map((urlEntry, index) => (
              <div key={index} className="grid items-end gap-3 md:grid-cols-[3fr_1fr_1fr_auto]">
                <div className={fieldClass}>
                  <label className={labelClass}>URL <span className="text-red-500">*</span></label>
                  <input className={inputClass} value={urlEntry.url} onChange={event => updateUrl(index, 'url', event.target.value)} placeholder="https://example.com/page" type="url" />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Page Type</label>
                  <select className={selectClass} value={urlEntry.pageType} onChange={event => updateUrl(index, 'pageType', event.target.value)}>
                    {PAGE_TYPES.map(value => <option key={value} value={value}>{value}</option>)}
                  </select>
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Priority</label>
                  <select className={selectClass} value={urlEntry.priority} onChange={event => updateUrl(index, 'priority', event.target.value)}>
                    {PRIORITIES.map(value => <option key={value} value={value}>{titleCase(value)}</option>)}
                  </select>
                </div>
                {urls.length > 1 && (
                  <button type="button" onClick={() => removeUrl(index)} className="rounded-md bg-red-100 px-3 py-2 text-red-800 transition hover:bg-red-200" aria-label="Remove URL">
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        <div className="flex justify-end gap-4 pt-2">
          <Link href="/projects" className="rounded-md border border-gray-300 px-5 py-2 text-sm text-gray-700 no-underline transition hover:bg-gray-100">
            Cancel
          </Link>
          <button type="submit" disabled={submitting} className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70">
            {submitting ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewProjectPage;
