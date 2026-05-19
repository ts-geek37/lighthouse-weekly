'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface UrlEntry {
  url: string;
  pageType: string;
  priority: string;
}

const PAGE_TYPES = ['homepage', 'login', 'signup', 'checkout', 'pricing', 'product', 'blog', 'other'];
const PRIORITIES = ['high', 'medium', 'low'];

export default function NewProjectPage() {
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

  function addUrl() {
    if (urls.length < 5) {
      setUrls([...urls, { url: '', pageType: 'homepage', priority: 'medium' }]);
    }
  }

  function removeUrl(index: number) {
    setUrls(urls.filter((_, i) => i !== index));
  }

  function updateUrl(index: number, field: keyof UrlEntry, value: string) {
    setUrls(urls.map((u, i) => (i === index ? { ...u, [field]: value } : u)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrors([]);

    const payload = {
      title,
      description: description || undefined,
      owner,
      priority,
      environment,
      reportEmail: reportEmail || undefined,
      urls: urls.filter((u) => u.url.trim() !== ''),
    };

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 201) {
        router.push('/projects');
      } else if (res.status === 422) {
        setErrors(data.details || [data.error]);
      } else {
        setErrors([data.error || 'An unexpected error occurred']);
      }
    } catch {
      setErrors(['Network error — please try again']);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <a href="/projects" style={styles.back}>← Back to projects</a>
        <h1 style={styles.title}>Add New Project</h1>
      </div>

      {errors.length > 0 && (
        <div style={styles.errorBox}>
          <strong>Please fix the following errors:</strong>
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Project Details</h2>

          <div style={styles.field}>
            <label style={styles.label}>Title <span style={styles.required}>*</span></label>
            <input style={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Main Marketing Site" required />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Description</label>
            <textarea style={{ ...styles.input, height: '80px', resize: 'vertical' }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Report Email(s)</label>
            <input style={styles.input} type="text" value={reportEmail} onChange={(e) => setReportEmail(e.target.value)} placeholder="e.g. alerts@example.com, team@example.com (comma separated, optional)" />
            <span style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.2rem' }}>
              Separate multiple email addresses with commas.
            </span>
          </div>

          <div style={styles.row}>
            <div style={{ ...styles.field, flex: 1 }}>
              <label style={styles.label}>Owner / Team <span style={styles.required}>*</span></label>
              <input style={styles.input} value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="e.g. Platform Team" required />
            </div>

            <div style={{ ...styles.field, flex: 1 }}>
              <label style={styles.label}>Priority</label>
              <select style={styles.input} value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>

            <div style={{ ...styles.field, flex: 1 }}>
              <label style={styles.label}>Environment <span style={styles.required}>*</span></label>
              <select style={styles.input} value={environment} onChange={(e) => setEnvironment(e.target.value)}>
                <option value="Production">Production</option>
                <option value="Staging">Staging</option>
              </select>
            </div>
          </div>
        </div>

        <div style={styles.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ ...styles.sectionTitle, margin: 0 }}>Monitored URLs <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 400 }}>(up to 5)</span></h2>
            {urls.length < 5 && (
              <button type="button" onClick={addUrl} style={styles.addUrlBtn}>+ Add URL</button>
            )}
          </div>

          {urls.map((urlEntry, index) => (
            <div key={index} style={styles.urlRow}>
              <div style={{ flex: 3 }}>
                <label style={styles.label}>URL <span style={styles.required}>*</span></label>
                <input
                  style={styles.input}
                  value={urlEntry.url}
                  onChange={(e) => updateUrl(index, 'url', e.target.value)}
                  placeholder="https://example.com/page"
                  type="url"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Page Type</label>
                <select style={styles.input} value={urlEntry.pageType} onChange={(e) => updateUrl(index, 'pageType', e.target.value)}>
                  {PAGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Priority</label>
                <select style={styles.input} value={urlEntry.priority} onChange={(e) => updateUrl(index, 'priority', e.target.value)}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              {urls.length > 1 && (
                <button type="button" onClick={() => removeUrl(index)} style={styles.removeBtn} aria-label="Remove URL">✕</button>
              )}
            </div>
          ))}
        </div>

        <div style={styles.actions}>
          <a href="/projects" style={styles.cancelBtn}>Cancel</a>
          <button type="submit" disabled={submitting} style={styles.submitBtn}>
            {submitting ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: '800px', margin: '0 auto', padding: '2rem', fontFamily: 'system-ui, sans-serif' },
  header: { marginBottom: '1.5rem' },
  back: { color: '#6b7280', textDecoration: 'none', fontSize: '0.9rem' },
  title: { margin: '0.5rem 0 0', fontSize: '1.75rem' },
  errorBox: { background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '1rem', marginBottom: '1.5rem', color: '#991b1b', fontSize: '0.9rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '1.5rem' },
  section: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.5rem' },
  sectionTitle: { margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 600 },
  field: { display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1rem' },
  row: { display: 'flex', gap: '1rem' },
  label: { fontSize: '0.875rem', fontWeight: 500, color: '#374151' },
  required: { color: '#ef4444' },
  input: { padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', width: '100%', boxSizing: 'border-box' as const },
  urlRow: { display: 'flex', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '0.75rem' },
  addUrlBtn: { background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '0.4rem 0.75rem', fontSize: '0.85rem', cursor: 'pointer' },
  removeBtn: { background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '6px', padding: '0.5rem 0.6rem', cursor: 'pointer', alignSelf: 'flex-end', marginBottom: '0' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '1rem', paddingTop: '0.5rem' },
  cancelBtn: { padding: '0.6rem 1.25rem', borderRadius: '6px', border: '1px solid #d1d5db', color: '#374151', textDecoration: 'none', fontSize: '0.9rem' },
  submitBtn: { padding: '0.6rem 1.5rem', borderRadius: '6px', background: '#2563eb', color: '#fff', border: 'none', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 500 },
};
