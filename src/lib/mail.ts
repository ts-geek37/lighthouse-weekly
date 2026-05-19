import nodemailer from 'nodemailer';
import type { Logger } from 'pino';
import { ProjectReport } from '@/types';

// Default configuration optimized for Gmail as requested
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, // App Password if 2FA is enabled
  },
});

export const sendReportEmail = async (
  to: string,
  projectReport: ProjectReport,
  log: Logger
): Promise<void> => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    log.warn('SMTP_USER or SMTP_PASS is not configured. Email will not be sent.');
    return;
  }

  // Generate a brief summary of the project report
  const subject = `Weekly Lighthouse Report: ${projectReport.projectTitle}`;
  
  let html = `
    <h2>Lighthouse Audit Report for ${projectReport.projectTitle}</h2>
    <p><strong>Environment:</strong> ${projectReport.environment}</p>
    <p><strong>Owner:</strong> ${projectReport.owner}</p>
    <hr />
    <h3>URLs Audited:</h3>
    <ul>
  `;

  for (const urlReport of projectReport.urls) {
    if (urlReport.status === 'failed') {
      html += `<li><strong>${urlReport.url}</strong>: ❌ Audit Failed</li>`;
      continue;
    }

    html += `
      <li>
        <strong>${urlReport.url}</strong> (${urlReport.pageType}):
        <ul>
          <li>Performance: ${urlReport.performanceScore !== null ? Math.round(urlReport.performanceScore) : 'N/A'}</li>
          <li>Accessibility: ${urlReport.accessibilityScore !== null ? Math.round(urlReport.accessibilityScore) : 'N/A'}</li>
          <li>SEO: ${urlReport.seoScore !== null ? Math.round(urlReport.seoScore) : 'N/A'}</li>
          <li>Best Practices: ${urlReport.bestPracticesScore !== null ? Math.round(urlReport.bestPracticesScore) : 'N/A'}</li>
        </ul>
      </li>
    `;
  }

  html += `
    </ul>
    <br/>
    <p>View the full detailed report in your dashboard or check the latest generated Markdown/JSON report in the system.</p>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"Lighthouse Monitoring" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    log.info({ messageId: info.messageId, to }, 'Report email sent successfully');
  } catch (err) {
    log.error({ err, to }, 'Failed to send report email');
  }
}
