#!/usr/bin/env node
'use strict';

// Creates one fully worked example end to end: a customer, a CBC booking,
// an uploaded PDF report, and structured values on it — one deliberately
// out of range so the abnormal-flagging insight has something to show.
//
// Usage:
//   node scripts/generate-sample-report.js <adminPhone> <adminPassword>
//
// The admin/staff account is required because POST /reports/:id/values is
// ADMIN/STAFF-only (matches the real workflow: staff key in results after
// a report PDF comes in). Use the account you promoted via SQL earlier.

const API = process.env.API_URL || 'http://localhost:3000';

const [, , adminPhone, adminPassword] = process.argv;
if (!adminPhone || !adminPassword) {
  console.error('Usage: node scripts/generate-sample-report.js <adminPhone> <adminPassword>');
  process.exit(1);
}

async function api(method, path, body, token, isForm) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

function minimalPdfBytes() {
  const pdf = [
    '%PDF-1.4',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj',
    'trailer<</Size 4/Root 1 0 R>>',
    '%%EOF',
  ].join('\n');
  return Buffer.from(pdf, 'utf8');
}

async function main() {
  console.log(`Using API at ${API}`);

  console.log('Logging in as admin/staff...');
  const adminAuth = await api('POST', '/auth/login', { phone: adminPhone, password: adminPassword });

  console.log('Registering a sample customer...');
  const customerPhone = `9${String(Date.now()).slice(-9)}`;
  const customerAuth = await api('POST', '/auth/register', {
    fullName: 'Sample Patient',
    phone: customerPhone,
    password: 'sample1234',
  });
  console.log(`  customer phone: ${customerPhone} (password: sample1234)`);

  console.log('Finding a center and the CBC test...');
  const centers = await api('GET', '/centers', undefined, customerAuth.accessToken);
  if (!centers.length) throw new Error('No centers found — run `npm run seed` first.');
  const center = centers[0];

  const tests = await api('GET', '/catalog/tests', undefined, customerAuth.accessToken);
  const cbc = tests.find((t) => t.name.includes('Complete Blood Count'));
  if (!cbc) throw new Error('CBC test not found — run `npm run seed` first.');

  console.log('Creating a booking...');
  const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const booking = await api(
    'POST',
    '/bookings',
    {
      centerId: center.id,
      collectionMode: 'WALK_IN',
      scheduledAt,
      items: [{ testId: cbc.id }],
    },
    customerAuth.accessToken,
  );
  console.log(`  booking id: ${booking.id}`);

  console.log('Uploading a sample report PDF...');
  const form = new FormData();
  form.append('file', new Blob([minimalPdfBytes()], { type: 'application/pdf' }), 'sample-report.pdf');
  const report = await api('POST', `/bookings/${booking.id}/reports`, form, adminAuth.accessToken, true);
  console.log(`  report id: ${report.id}`);

  console.log('Adding structured values (one deliberately abnormal)...');
  const values = await api(
    'POST',
    `/reports/${report.id}/values`,
    {
      values: [
        // CBC's seeded normal range is 12-16 g/dL (Hemoglobin) — this is
        // inside it, so it renders as a plain, non-flagged value.
        { testId: cbc.id, testName: 'Hemoglobin', value: 13.8, unit: 'g/dL' },
        // Below 12 -> isAbnormal computed true server-side -> shows red.
        { testId: cbc.id, testName: 'Hemoglobin (Low sample)', value: 9.2, unit: 'g/dL' },
        // WBC has no matching Test row here, so it's entered free-form —
        // no normal range means it never gets flagged either way.
        { testName: 'WBC Count', value: 7200, unit: '/uL' },
      ],
    },
    adminAuth.accessToken,
  );

  console.log('');
  console.log('Done. Values as stored:');
  for (const v of values) {
    const flag = v.isAbnormal ? '*** ABNORMAL ***' : 'normal';
    console.log(`  ${v.testName}: ${v.value} ${v.unit ?? ''} (range ${v.normalLow ?? '-'}-${v.normalHigh ?? '-'}) [${flag}]`);
  }
  console.log('');
  console.log(`View it: log into admin-web or customer-web and open booking ${booking.id}`);
  console.log(`Customer login for that booking: phone ${customerPhone}, password sample1234`);
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
