/**
 * Generate Supabase ANON_KEY and SERVICE_ROLE_KEY from JWT_SECRET.
 *
 * Usage: node generate-jwt-keys.js <JWT_SECRET>
 */

import crypto from 'crypto';

const JWT_SECRET = process.argv[2];
if (!JWT_SECRET) {
  console.error('Usage: node generate-jwt-keys.js <JWT_SECRET>');
  process.exit(1);
}

function generateJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const headerB64 = encode(header);
  const payloadB64 = encode(payload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');
  return `${headerB64}.${payloadB64}.${signature}`;
}

const now = Math.floor(Date.now() / 1000);
const tenYears = 10 * 365 * 24 * 60 * 60;

const anonPayload = {
  role: 'anon',
  iss: 'supabase',
  iat: now,
  exp: now + tenYears,
};

const serviceRolePayload = {
  role: 'service_role',
  iss: 'supabase',
  iat: now,
  exp: now + tenYears,
};

const ANON_KEY = generateJWT(anonPayload, JWT_SECRET);
const SERVICE_ROLE_KEY = generateJWT(serviceRolePayload, JWT_SECRET);

console.log('');
console.log('=== Generated Supabase API Keys ===');
console.log('');
console.log(`ANON_KEY=${ANON_KEY}`);
console.log('');
console.log(`SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}`);
console.log('');
console.log('Copy these values to your .env file.');
