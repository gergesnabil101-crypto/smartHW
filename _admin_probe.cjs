const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const FB_KEY = 'AIzaSyAb63N0TnxOXHHRCQ7h1gV5NfUJ2zoHGYk';
const API = 'https://mosahah-api-609470896445.europe-west1.run.app';

const db = new DatabaseSync(path.join(process.env.APPDATA, 'gcloud', 'credentials.db'), { readOnly: true });
const rows = db.prepare('SELECT account_id, value FROM credentials').all();
db.close();
const CLIENT_ID = '32555940559.apps.googleusercontent.com';
const CLIENT_SECRET = 'ZmssLNjJy2998hD4CTg2ejr2';

async function main() {
  const row = rows.find(r => { try { return JSON.parse(r.value).refresh_token; } catch { return false; } });
  const refreshToken = JSON.parse(row.value).refresh_token;
  const t = await (await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refreshToken, grant_type: 'refresh_token', scope: 'https://www.googleapis.com/auth/cloud-platform' }),
  })).json();
  if (!t.access_token) { console.log('oauth fail', JSON.stringify(t)); return; }
  console.log('google token ok');

  // Exchange Google access token -> Firebase ID token (admin's own Google account)
  const fb = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FB_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postBody: `access_token=${t.access_token}&providerId=google.com`, requestUri: 'https://localhost', returnIdpCredential: true, returnSecureToken: true }),
  })).json();
  if (!fb.idToken) { console.log('fb exchange fail', JSON.stringify(fb).slice(0, 400)); return; }
  console.log('firebase id token ok —', fb.email);

  const users = await (await fetch(`${API}/api/admin/users`, {
    headers: { Authorization: `Bearer ${fb.idToken}` },
  })).json();
  const list = users.users || users || [];
  console.log('users:', list.length, '| categories:', JSON.stringify(users.categories || {}));
  const now = Date.now();
  for (const u of list) {
    const end = u.subscription_end_date ? new Date(u.subscription_end_date) : null;
    const days = end ? Math.ceil((end.getTime() - now) / 86400000) : null;
    console.log(
      (u.email || u.name || '?').padEnd(38).slice(0, 38),
      '| st:', String(u.subscription_status || '-').padEnd(8),
      '| dur:', u.subscription_duration_days || '-',
      '| start:', (u.subscription_start_date || '-').slice(0, 10),
      '| end:', (u.subscription_end_date || '-').slice(0, 10),
      '| days:', days
    );
  }
}
main().catch(e => console.log('err', e.message));
