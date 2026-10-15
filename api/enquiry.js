// Vercel serverless function: emails every website form submission to the EcoHome team.
//
// Required Vercel environment variable:
//   RESEND_API_KEY  - API key from resend.com (the ecohomegb.com domain must be verified there)
// Optional:
//   ENQUIRY_TO      - comma-separated recipients (default: info@ and walid@ecohomegb.com)
//   ENQUIRY_FROM    - sender shown on the email (default: EcoHome Website <website@ecohomegb.com>)

const DEFAULT_TO = 'info@ecohomegb.com,walid@ecohomegb.com';
const DEFAULT_FROM = 'EcoHome Website <website@ecohomegb.com>';
const MAX_FIELDS = 40;
const MAX_VALUE = 5000;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const oneLine = (s) => String(s).replace(/[\r\n]+/g, ' ').trim();
const isEmail = (s) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(500).json({ ok: false, error: 'Email is not configured' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== 'object' || !body.fields || typeof body.fields !== 'object') {
    return res.status(400).json({ ok: false, error: 'Invalid request' });
  }

  // Honeypot: real visitors never fill this hidden field, bots usually do.
  if (body.website) return res.status(200).json({ ok: true });

  const entries = Object.entries(body.fields)
    .slice(0, MAX_FIELDS)
    .map(([k, v]) => [oneLine(k).slice(0, 120), String(v ?? '').slice(0, MAX_VALUE)])
    .filter(([k]) => k);

  const subject = oneLine(body.subject || 'Website enquiry').slice(0, 150);
  const replyTo = isEmail(String(body.replyTo || '')) ? String(body.replyTo) : undefined;
  const page = oneLine(body.page || '').slice(0, 300);

  const rows = entries.map(([k, v]) =>
    `<tr><td style="padding:8px 14px 8px 0;vertical-align:top;color:#5A6050;font-size:13px;white-space:nowrap">${esc(k)}</td>` +
    `<td style="padding:8px 0;font-size:14px;color:#1A2A1A;white-space:pre-wrap">${esc(v) || '<span style="color:#9AA090">—</span>'}</td></tr>`
  ).join('');
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:640px">` +
    `<h2 style="font-family:Georgia,serif;font-weight:normal;color:#1A2A1A;margin:0 0 16px">${esc(subject)}</h2>` +
    `<table style="border-collapse:collapse;width:100%">${rows}</table>` +
    (page ? `<p style="margin-top:20px;font-size:12px;color:#8A9080">Sent from ${esc(page)}</p>` : '') +
    `</div>`;
  const text = entries.map(([k, v]) => `${k}: ${v}`).join('\n') + (page ? `\n\nSent from ${page}` : '');

  const to = (process.env.ENQUIRY_TO || DEFAULT_TO).split(',').map((s) => s.trim()).filter(Boolean);

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.ENQUIRY_FROM || DEFAULT_FROM,
        to,
        subject,
        html,
        text,
        ...(replyTo ? { reply_to: replyTo } : {})
      })
    });
    if (!r.ok) {
      console.error('Resend error', r.status, await r.text());
      return res.status(502).json({ ok: false, error: 'Email could not be sent' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Resend request failed', err);
    return res.status(502).json({ ok: false, error: 'Email could not be sent' });
  }
};
