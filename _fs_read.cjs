const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const PROJECT = 'gen-lang-client-0552360485';

const db = new DatabaseSync(path.join(process.env.APPDATA, 'gcloud', 'credentials.db'), { readOnly: true });
const rows = db.prepare('SELECT account_id, value FROM credentials').all();
db.close();

async function getToken() {
  const row = rows.find(r => { try { return JSON.parse(r.value).refresh_token; } catch { return false; } });
  const rt = JSON.parse(row.value).refresh_token;
  const t = await (await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: '32555940559.apps.googleusercontent.com', client_secret: 'ZmssLNjJy2998hD4CTg2ejr2', refresh_token: rt, grant_type: 'refresh_token', scope: 'https://www.googleapis.com/auth/cloud-platform' }),
  })).json();
  return t.access_token;
}

const val = (f) => f ? (f.stringValue ?? f.integerValue ?? f.doubleValue ?? f.booleanValue ?? f.timestampValue ?? (f.nullValue !== undefined ? null : JSON.stringify(f).slice(0, 60))) : null;

async function main() {
  const tok = await getToken();
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users?pageSize=200`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${tok}`, 'x-goog-user-project': PROJECT } });
  const j = await r.json();
  if (j.error) { console.log('err', r.status, JSON.stringify(j.error).slice(0, 300)); return; }
  const docs = j.documents || [];
  const now = Date.now();
  console.log('docs:', docs.length);
  for (const d of docs) {
    const f = d.fields || {};
    const end = val(f.subscription_end_date);
    const endT = end ? new Date(end).getTime() : null;
    const days = endT ? Math.ceil((endT - now) / 86400000) : null;
    console.log(
      (val(f.email) || d.name.split('/').pop()).padEnd(40).slice(0, 40),
      '| st:', String(val(f.subscription_status) || '-').padEnd(8),
      '| dur:', val(f.subscription_duration_days) || '-',
      '| start:', String(val(f.subscription_start_date) || '-').slice(0, 10),
      '| end:', String(end || '-').slice(0, 10),
      '| days:', days,
      '| susp:', val(f.is_suspended)
    );
  }
}
main().catch(e => console.log('err', e.message));
