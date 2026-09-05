const {
  classifyGeneratedHostResponse,
  safeReasonCode,
} = require('./web-smoke-harness.cjs');

function readGeneratedUrl(environment = process.env) {
  const raw = environment.GENESIS_VERCEL_GENERATED_URL;
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new Error('GENESIS_VERCEL_GENERATED_URL_REQUIRED');
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('GENESIS_VERCEL_GENERATED_URL_INVALID');
  }
  if (
    url.protocol !== 'https:' ||
    !url.hostname.endsWith('.vercel.app') ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== '' ||
    url.pathname !== '/' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new Error('GENESIS_VERCEL_GENERATED_URL_INVALID');
  }
  return url;
}

async function main() {
  try {
    const generated = readGeneratedUrl();
    const probe = new URL('/api/v1/auth/csrf', generated);
    const response = await fetch(probe, {
      redirect: 'manual',
      headers: { 'user-agent': 'genesis-operational-validator/3' },
    });
    const result = classifyGeneratedHostResponse({
      status: response.status,
      body: await response.text(),
      headers: response.headers,
      generatedHost: generated.hostname,
    });
    console.log(JSON.stringify({ result: 'PASS', generated: result }));
  } catch (error) {
    console.error(
      JSON.stringify({ result: 'FAIL', reasonCode: safeReasonCode(error) }),
    );
    process.exitCode = 1;
  }
}

void main();
