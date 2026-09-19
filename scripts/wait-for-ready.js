#!/usr/bin/env node
'use strict';

// Polls every service `npm run dev` starts and prints a single banner once
// they are all answering. Without this the four concurrently panes interleave
// and there is no moment that clearly says "you can start testing now".
//
// GET /catalog/tests is unauthenticated and hits the database, so a 200 from
// it proves the API booted *and* Postgres accepted a query. The row count
// tells us whether the seed has been run yet.

const http = require('http');

const API = process.env.API_URL || 'http://localhost:3000';
const ADMIN = process.env.ADMIN_URL || 'http://localhost:5173';
const WEB = process.env.WEB_URL || 'http://localhost:5174';

const POLL_INTERVAL_MS = 1500;
const ATTEMPT_TIMEOUT_MS = 2500;
// Postgres runs initdb on a fresh volume, which can take a couple of minutes
// on Docker Desktop. Give the whole stack longer than that before giving up.
const OVERALL_TIMEOUT_MS = 240000;

function probe(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () =>
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 500, body: Buffer.concat(chunks).toString('utf8') }),
      );
    });
    req.setTimeout(ATTEMPT_TIMEOUT_MS, () => req.destroy());
    req.on('error', () => resolve({ ok: false }));
  });
}

function countSeededTests(body) {
  try {
    const parsed = JSON.parse(body);
    return Array.isArray(parsed) ? parsed.length : null;
  } catch {
    return null;
  }
}

async function main() {
  const startedAt = Date.now();
  const pending = new Set(['api', 'admin', 'web']);
  let seededTests = null;
  let lastNotice = 0;

  while (pending.size > 0) {
    if (Date.now() - startedAt > OVERALL_TIMEOUT_MS) {
      console.error(`Gave up after ${Math.round(OVERALL_TIMEOUT_MS / 1000)}s. Still not answering: ${[...pending].join(', ')}`);
      console.error('Check the pane for each one above for the actual error.');
      process.exit(1);
    }

    const [api, admin, web] = await Promise.all([
      probe(`${API}/catalog/tests`),
      probe(ADMIN),
      probe(WEB),
    ]);

    if (api.ok) {
      pending.delete('api');
      if (seededTests === null) seededTests = countSeededTests(api.body);
    }
    if (admin.ok) pending.delete('admin');
    if (web.ok) pending.delete('web');

    if (pending.size === 0) break;

    // A heartbeat every ~15s, so a slow first boot doesn't look like a hang.
    if (Date.now() - lastNotice > 15000) {
      const waited = Math.round((Date.now() - startedAt) / 1000);
      console.log(`waiting on ${[...pending].join(', ')} (${waited}s)`);
      lastNotice = Date.now();
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  const took = Math.round((Date.now() - startedAt) / 1000);
  console.log('');
  console.log('========================================');
  console.log(`  ALL SERVICES HEALTHY  (${took}s)`);
  console.log('========================================');
  console.log(`  API             ${API}`);
  console.log(`  Admin console   ${ADMIN}`);
  console.log(`  Customer portal ${WEB}`);
  console.log('----------------------------------------');
  if (seededTests === null) {
    console.log('  Database: connected');
  } else if (seededTests === 0) {
    console.log('  Database: connected, but NO TESTS FOUND');
    console.log('  Run `npm run seed` in another terminal.');
  } else {
    console.log(`  Database: connected, ${seededTests} tests seeded`);
  }
  console.log('========================================');
  console.log('');
}

main();
