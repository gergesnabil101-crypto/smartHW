const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const PROJECT = 'gen-lang-client-0552360485';
const REGION = 'europe-west1';
const SERVICE = 'mosahah-api';
const NEW_KEY = 'AIzaSyA8B2HBBpngF1Kp10JpeDekUFbQRXe92VA';

const db = new DatabaseSync(path.join(process.env.APPDATA, 'gcloud', 'credentials.db'), { readOnly: true });
const rows = db.prepare('SELECT account_id, value FROM credentials').all();
db.close();
const CLIENT_ID = '32555940559.apps.googleusercontent.com';
const CLIENT_SECRET = 'ZmssLNjJy2998hD4CTg2ejr2';

async function getToken() {
  const row = rows.find(r => { try { return JSON.parse(r.value).refresh_token; } catch { return false; } });
  const refreshToken = JSON.parse(row.value).refresh_token;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refreshToken, grant_type: 'refresh_token', scope: 'https://www.googleapis.com/auth/cloud-platform' }),
  });
  return (await r.json()).access_token;
}

async function main() {
  const tok = await getToken();
  const base = `https://run.googleapis.com/v2/projects/${PROJECT}/locations/${REGION}/services/${SERVICE}`;
  const H = { Authorization: `Bearer ${tok}`, 'x-goog-user-project': PROJECT, 'Content-Type': 'application/json' };

  const svc = await (await fetch(base, { headers: H })).json();
  const env = svc.template.containers[0].env || [];
  const found = env.find(e => e.name === 'GEMINI_API_KEY');
  if (found) found.value = NEW_KEY; else env.push({ name: 'GEMINI_API_KEY', value: NEW_KEY });

  // minimal update body — just the container spec, everything else untouched via mask
  const body = { template: { containers: svc.template.containers } };
  const pr = await fetch(`${base}?updateMask=template.containers`, {
    method: 'PATCH', headers: H, body: JSON.stringify(body),
  });
  console.log('patch status', pr.status);
  console.log((await pr.text()).slice(0, 300));
}
main().catch(e => console.log('err', e.message));
