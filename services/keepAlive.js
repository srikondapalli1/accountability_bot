const PING_INTERVAL_MS = 14 * 60 * 1000;

function getPingUrl() {
  const base = process.env.RENDER_EXTERNAL_URL || process.env.PING_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/health`;
}

async function ping(url) {
  try {
    const res = await fetch(url);
    console.log(`Keep-alive ping: ${res.status} ${url}`);
  } catch (err) {
    console.error('Keep-alive ping failed:', err.message);
  }
}

export function startKeepAlive() {
  const url = getPingUrl();
  if (!url) {
    console.log('Keep-alive pinger disabled (set RENDER_EXTERNAL_URL or PING_URL)');
    return;
  }

  ping(url);
  setInterval(() => ping(url), PING_INTERVAL_MS);
  console.log(`Keep-alive pinger started (every 14m → ${url})`);
}
