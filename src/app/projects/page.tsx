'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProjectResponse } from '@/types';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/projects')
      .then((res) => res.json())
      .then((data) => {
        setProjects(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load projects');
        setLoading(false);
      });
  }, []);

  async function toggleStatus(id: string, isActive: boolean) {
    try {
      const res = await fetch(`/api/projects/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
      }
    } catch {
      alert('Failed to update project status');
    }
  }

  async function deleteProject(id: string) {
    if (!confirm('Delete this project and all its audit data?')) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (res.status === 204) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
      }
    } catch {
      alert('Failed to delete project');
    }
  }

  if (loading) return <div style={styles.container}><p>Loading projects...</p></div>;
  if (error) return <div style={styles.container}><p style={{ color: 'red' }}>{error}</p></div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Lighthouse Monitoring</h1>
        <Link href="/projects/new" style={styles.button}>
          + Add Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div style={styles.empty}>
          <p>No projects yet.</p>
          <Link href="/projects/new" style={styles.button}>Add your first project</Link>
        </div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Project</th>
              <th style={styles.th}>Owner</th>
              <th style={styles.th}>Environment</th>
              <th style={styles.th}>URLs</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id} style={styles.tr}>
                <td style={styles.td}>
                  <strong>{project.title}</strong>
                  {project.description && (
                    <div style={{ fontSize: '0.85em', color: '#666' }}>{project.description}</div>
                  )}
                </td>
                <td style={styles.td}>{project.owner}</td>
                <td style={styles.td}>
                  <span style={{
                    ...styles.badge,
                    background: project.environment === 'Production' ? '#d1fae5' : '#fef3c7',
                    color: project.environment === 'Production' ? '#065f46' : '#92400e',
                  }}>
                    {project.environment}
                  </span>
                </td>
                <td style={styles.td}>
                  <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                    {project.urls.map((u) => (
                      <li key={u.id} style={{ fontSize: '0.85em' }}>
                        <span style={{ color: '#666' }}>[{u.pageType}]</span>{' '}
                        <a href={u.url} target="_blank" rel="noopener noreferrer">{u.url}</a>
                      </li>
                    ))}
                  </ul>
                </td>
                <td style={styles.td}>
                  <span style={{
                    ...styles.badge,
                    background: project.isActive ? '#d1fae5' : '#fee2e2',
                    color: project.isActive ? '#065f46' : '#991b1b',
                  }}>
                    {project.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={styles.td}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Link href={`/projects/${project.id}/edit`} style={styles.actionBtn}>
                      Edit
                    </Link>
                    <button
                      onClick={() => toggleStatus(project.id, project.isActive)}
                      style={{ ...styles.actionBtn, cursor: 'pointer', border: 'none' }}
                    >
                      {project.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => deleteProject(project.id)}
                      style={{ ...styles.actionBtn, cursor: 'pointer', border: 'none', background: '#fee2e2', color: '#991b1b' }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: '1200px', margin: '0 auto', padding: '2rem', fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' },
  title: { margin: 0, fontSize: '1.75rem' },
  button: { background: '#2563eb', color: '#fff', padding: '0.5rem 1rem', borderRadius: '6px', textDecoration: 'none', fontSize: '0.9rem' },
  empty: { textAlign: 'center', padding: '3rem', color: '#666' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '0.75rem', borderBottom: '2px solid #e5e7eb', fontWeight: 600, fontSize: '0.875rem', color: '#374151' },
  tr: { borderBottom: '1px solid #e5e7eb' },
  td: { padding: '0.75rem', verticalAlign: 'top', fontSize: '0.9rem' },
  badge: { display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 500 },
  actionBtn: { display: 'inline-block', padding: '0.25rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', background: '#f3f4f6', color: '#374151', textDecoration: 'none' },
};
