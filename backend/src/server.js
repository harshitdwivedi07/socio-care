import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { z } from 'zod';

const { JWT_SECRET, DATABASE_URL, CORS_ORIGINS = '', PORT = 3000 } = process.env;
if (!JWT_SECRET || JWT_SECRET.length < 32 || !DATABASE_URL) {
  console.error('Set DATABASE_URL and a JWT_SECRET of at least 32 characters.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});
const q = (text, params) => pool.query(text, params);
const TODAY = "(now() at time zone 'Asia/Kolkata')::date";
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
const origins = CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: (o, cb) => cb(null, !o || origins.includes(o)) }));
app.use(express.json({ limit: '50kb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: Number(process.env.AUTH_RATE_LIMIT) || 10, standardHeaders: true, legacyHeaders: false });
const sosLimit = rateLimit({ windowMs: 60 * 1000, limit: 5 });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
for (const name of ['id', 'elderId']) {
  app.param(name, (req, res, next, v) => (UUID.test(v) ? next() : res.status(400).json({ error: 'Invalid request.' })));
}

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const body = (schema) => (req, res, next) => {
  const r = schema.safeParse(req.body);
  if (!r.success) return res.status(400).json({ error: 'Please check the details and try again.' });
  req.data = r.data;
  next();
};
const audit = (owner, actor, action) => q('insert into audit_log(owner_id,actor_id,action) values($1,$2,$3)', [owner, actor, action]);

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  try {
    const p = jwt.verify(h.replace(/^Bearer /, ''), JWT_SECRET, { algorithms: ['HS256'] });
    req.uid = p.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Please sign in again.' });
  }
}

async function issue(uid) {
  const access = jwt.sign({ sub: uid }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '30m' });
  const refresh = crypto.randomBytes(32).toString('hex');
  await q("insert into refresh_tokens(token_hash,user_id,expires_at) values($1,$2,now()+interval '30 days')", [sha(refresh), uid]);
  return { access, refresh };
}

// ---------- Auth ----------
const email = z.string().trim().toLowerCase().email().max(120);
const password = z.string().min(10).max(128);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/auth/register', authLimit, body(z.object({ email, password, name: z.string().trim().min(1).max(60) })), wrap(async (req, res) => {
  const { email: e, password: p, name } = req.data;
  const hash = await bcrypt.hash(p, 12);
  try {
    const r = await q('insert into users(email,password_hash,name) values($1,$2,$3) returning id', [e, hash, name]);
    res.status(201).json(await issue(r.rows[0].id));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Could not create the account with these details.' });
    throw err;
  }
}));

app.post('/auth/login', authLimit, body(z.object({ email, password: z.string().max(128) })), wrap(async (req, res) => {
  const r = await q('select id,password_hash from users where email=$1', [req.data.email]);
  const ok = await bcrypt.compare(req.data.password, r.rows[0]?.password_hash || DUMMY_HASH);
  if (!r.rows[0] || !ok) return res.status(401).json({ error: 'Email or password is incorrect.' });
  res.json(await issue(r.rows[0].id));
}));

app.post('/auth/refresh', authLimit, body(z.object({ refresh: z.string().length(64) })), wrap(async (req, res) => {
  const r = await q('delete from refresh_tokens where token_hash=$1 and expires_at>now() returning user_id', [sha(req.data.refresh)]);
  if (!r.rows[0]) return res.status(401).json({ error: 'Please sign in again.' });
  res.json(await issue(r.rows[0].user_id)); // rotation: old token is single-use
}));

app.post('/auth/logout', body(z.object({ refresh: z.string().length(64) })), wrap(async (req, res) => {
  await q('delete from refresh_tokens where token_hash=$1', [sha(req.data.refresh)]);
  res.json({ ok: true });
}));

app.get('/me', auth, wrap(async (req, res) => {
  const r = await q('select id,email,name from users where id=$1', [req.uid]);
  res.json(r.rows[0]);
}));

app.delete('/me', auth, wrap(async (req, res) => {
  await q('delete from users where id=$1', [req.uid]); // cascades to all of the user's data
  res.json({ ok: true });
}));

// ---------- Medicines ----------
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
app.get('/medicines', auth, wrap(async (req, res) => {
  const r = await q(`select m.id,m.name,m.note,m.time_of_day,(l.medicine_id is not null) as taken
    from medicines m left join med_logs l on l.medicine_id=m.id and l.day=${TODAY}
    where m.user_id=$1 and m.active order by m.time_of_day`, [req.uid]);
  res.json(r.rows);
}));
app.post('/medicines', auth, body(z.object({ name: z.string().trim().min(1).max(80), note: z.string().trim().max(120).optional(), time_of_day: hhmm })), wrap(async (req, res) => {
  const d = req.data;
  const r = await q('insert into medicines(user_id,name,note,time_of_day) values($1,$2,$3,$4) returning id', [req.uid, d.name, d.note || null, d.time_of_day]);
  res.status(201).json(r.rows[0]);
}));
app.post('/medicines/:id/taken', auth, wrap(async (req, res) => {
  const r = await q(`insert into med_logs(medicine_id) select id from medicines where id=$1 and user_id=$2
    on conflict do nothing returning medicine_id`, [req.params.id, req.uid]);
  const owns = await q('select 1 from medicines where id=$1 and user_id=$2', [req.params.id, req.uid]);
  if (!owns.rows[0]) return res.status(404).json({ error: 'Not found.' });
  res.json({ ok: true, new: r.rowCount > 0 });
}));
app.delete('/medicines/:id', auth, wrap(async (req, res) => {
  await q('update medicines set active=false where id=$1 and user_id=$2', [req.params.id, req.uid]);
  res.json({ ok: true });
}));

// ---------- Appointments ----------
app.get('/appointments', auth, wrap(async (req, res) => {
  res.json((await q('select id,doctor,at,note from appointments where user_id=$1 and at>now()-interval \'1 day\' order by at', [req.uid])).rows);
}));
app.post('/appointments', auth, body(z.object({ doctor: z.string().trim().min(1).max(80), at: z.string().datetime(), note: z.string().trim().max(160).optional() })), wrap(async (req, res) => {
  const d = req.data;
  if (new Date(d.at) < new Date()) return res.status(400).json({ error: 'Choose a future time.' });
  const r = await q('insert into appointments(user_id,doctor,at,note) values($1,$2,$3,$4) returning id', [req.uid, d.doctor, d.at, d.note || null]);
  res.status(201).json(r.rows[0]);
}));

// ---------- Health readings ----------
const ranges = { sugar: [30, 600], weight: [20, 250] };
app.get('/readings', auth, wrap(async (req, res) => {
  res.json((await q('select id,kind,value,taken_at from readings where user_id=$1 order by taken_at desc limit 50', [req.uid])).rows);
}));
app.post('/readings', auth, body(z.object({ kind: z.enum(['bp', 'sugar', 'weight']), value: z.string().trim().max(12) })), wrap(async (req, res) => {
  const { kind, value } = req.data;
  const ok = kind === 'bp'
    ? /^(\d{2,3})\/(\d{2,3})$/.test(value) && value.split('/').every((n) => n >= 30 && n <= 300)
    : Number.isFinite(+value) && +value >= ranges[kind][0] && +value <= ranges[kind][1];
  if (!ok) return res.status(400).json({ error: 'That value looks out of range.' });
  await q('insert into readings(user_id,kind,value) values($1,$2,$3)', [req.uid, kind, value]);
  res.status(201).json({ ok: true });
}));

// ---------- SOS ----------
app.get('/sos/contacts', auth, wrap(async (req, res) => {
  res.json((await q('select id,name,phone from sos_contacts where user_id=$1', [req.uid])).rows);
}));
app.post('/sos/contacts', auth, body(z.object({ name: z.string().trim().min(2).max(40), phone: z.string().regex(/^[6-9]\d{9}$/) })), wrap(async (req, res) => {
  const n = await q('select count(*)::int c from sos_contacts where user_id=$1', [req.uid]);
  if (n.rows[0].c >= 5) return res.status(400).json({ error: 'You can add up to 5 contacts.' });
  await q('insert into sos_contacts(user_id,name,phone) values($1,$2,$3)', [req.uid, req.data.name, req.data.phone]);
  res.status(201).json({ ok: true });
}));
app.delete('/sos/contacts/:id', auth, wrap(async (req, res) => {
  await q('delete from sos_contacts where id=$1 and user_id=$2', [req.params.id, req.uid]);
  res.json({ ok: true });
}));
app.post('/sos', auth, sosLimit, body(z.object({ lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional() })), wrap(async (req, res) => {
  await q('insert into sos_events(user_id,lat,lng) values($1,$2,$3)', [req.uid, req.data.lat ?? null, req.data.lng ?? null]);
  await audit(req.uid, req.uid, 'sos_triggered');
  const c = await q('select name,phone from sos_contacts where user_id=$1', [req.uid]);
  // TODO: send SMS/push to c.rows and linked caregivers via your provider (e.g. Twilio, MSG91, FCM).
  res.json({ ok: true, notified: c.rowCount });
}));

// ---------- Caregivers (consent-based) ----------
app.post('/caregivers/invite', auth, body(z.object({ view_meds: z.boolean(), view_appts: z.boolean() })), wrap(async (req, res) => {
  const code = crypto.randomBytes(6).toString('hex');
  await q("insert into caregiver_links(elder_id,view_meds,view_appts,code_hash,code_expires) values($1,$2,$3,$4,now()+interval '48 hours')",
    [req.uid, req.data.view_meds, req.data.view_appts, sha(code)]);
  res.status(201).json({ code, expires_in_hours: 48 });
}));
app.post('/caregivers/redeem', auth, authLimit, body(z.object({ code: z.string().length(12) })), wrap(async (req, res) => {
  const r = await q(`update caregiver_links set caregiver_id=$1,status='active',code_hash=null,code_expires=null
    where code_hash=$2 and status='pending' and code_expires>now() and elder_id<>$1 returning elder_id`, [req.uid, sha(req.data.code)]);
  if (!r.rows[0]) return res.status(400).json({ error: 'This code is not valid or has expired.' });
  await audit(r.rows[0].elder_id, req.uid, 'caregiver_linked');
  res.json({ ok: true });
}));
app.get('/caregivers', auth, wrap(async (req, res) => {
  const mine = await q(`select l.id,l.status,l.view_meds,l.view_appts,u.name from caregiver_links l left join users u on u.id=l.caregiver_id
    where l.elder_id=$1 and l.status<>'revoked'`, [req.uid]);
  const caring = await q(`select l.id,l.elder_id,l.view_meds,l.view_appts,u.name from caregiver_links l join users u on u.id=l.elder_id
    where l.caregiver_id=$1 and l.status='active'`, [req.uid]);
  res.json({ my_caregivers: mine.rows, people_i_care_for: caring.rows });
}));
app.patch('/caregivers/:id', auth, body(z.object({ view_meds: z.boolean(), view_appts: z.boolean() })), wrap(async (req, res) => {
  await q('update caregiver_links set view_meds=$1,view_appts=$2 where id=$3 and elder_id=$4', [req.data.view_meds, req.data.view_appts, req.params.id, req.uid]);
  await audit(req.uid, req.uid, 'consent_changed');
  res.json({ ok: true });
}));
app.delete('/caregivers/:id', auth, wrap(async (req, res) => {
  await q("update caregiver_links set status='revoked' where id=$1 and (elder_id=$2 or caregiver_id=$2)", [req.params.id, req.uid]);
  await audit(req.uid, req.uid, 'caregiver_revoked');
  res.json({ ok: true });
}));
app.get('/care/:elderId/medicines', auth, wrap(async (req, res) => {
  const l = await q("select 1 from caregiver_links where elder_id=$1 and caregiver_id=$2 and status='active' and view_meds", [req.params.elderId, req.uid]);
  if (!l.rows[0]) return res.status(403).json({ error: 'Access is not allowed.' });
  await audit(req.params.elderId, req.uid, 'caregiver_viewed_meds');
  const r = await q(`select m.name,m.time_of_day,(l.medicine_id is not null) as taken from medicines m
    left join med_logs l on l.medicine_id=m.id and l.day=${TODAY} where m.user_id=$1 and m.active order by m.time_of_day`, [req.params.elderId]);
  res.json(r.rows);
}));
app.get('/audit', auth, wrap(async (req, res) => {
  res.json((await q('select actor_id=owner_id as by_me,action,created_at from audit_log where owner_id=$1 order by id desc limit 50', [req.uid])).rows);
}));

// ---------- Helper (Groq AI, with safe fallback) ----------
const helperLimit = rateLimit({ windowMs: 60 * 1000, limit: 10 });
const LANG = { en: 'English', hi: 'Hindi', te: 'Telugu' };
const SYS = 'You are the friendly helper inside Socio Care, an app for elderly people in India. Answer in 1 to 3 short, simple sentences. Help with using the app (medicines, appointments, SOS, family, health log) and general wellbeing tips. Never diagnose and never suggest doses or changing medicines; for symptoms or medicine questions tell the person to ask their doctor or pharmacist, and for emergencies tell them to press SOS or call 112. Reply in ';
const MED_SYS = 'You are a helpful medicine information assistant for elderly people in India. When given a medicine name, explain in 2 to 4 short simple sentences: what it is commonly used for, common side effects to watch for, and whether it should be taken with or without food. Never suggest doses or tell anyone to change their medicine. Always end by saying: Please confirm with your doctor or pharmacist. Reply in ';
function rule(m) {
  m = m.toLowerCase();
  if (/pain|chest|breath|dizz|faint|bleed|stroke/.test(m)) return 'This may be serious. Press SOS or call 112 now. For other symptoms, please speak to your doctor.';
  if (/medic|tablet|pill|dawa|dose/.test(m)) return 'Open Medicines to see today\'s doses and tap "I took it". For questions about a medicine, please ask your doctor or pharmacist.';
  if (/doctor|appoint|visit/.test(m)) return 'Open Appointments to book or see your next visit.';
  if (/family|son|daughter|caregiver|invite/.test(m)) return 'Open Family to invite someone. You choose what they can see, and you can remove them anytime.';
  if (/sos|emergency|help/.test(m)) return 'Press the big white SOS tile. You have 5 seconds to cancel. In a real emergency also call 112.';
  return 'I can help with medicines, appointments, family and SOS. Try asking about one of them.';
}
async function groq(systemPrompt, userMessage) {
  const key = process.env.GROQ_API_KEY;
  if (!key) { console.error('groq: GROQ_API_KEY is not set'); return null; }
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
        reasoning_effort: 'low',
        max_tokens: 800,
        messages: [
          { role: 'system', content: systemPrompt + ' Use plain text only. Never use emojis, markdown, asterisks, bullet points or headings.' },
          { role: 'user', content: userMessage },
        ],
      }),
    });
    const j = await r.json();
    if (!r.ok) { console.error('groq error:', r.status, j.error?.message); return null; }
    return j.choices?.[0]?.message?.content || null;
  } catch (e) { console.error('groq:', e.message); return null; }
}
app.post('/assistant', auth, helperLimit, body(z.object({ message: z.string().trim().min(1).max(300), lang: z.enum(['en', 'hi', 'te']).default('en') })), wrap(async (req, res) => {
  const text = await groq(SYS + LANG[req.data.lang] + '.', req.data.message);
  res.json({ reply: text || rule(req.data.message) });
}));
app.post('/medicine-info', auth, helperLimit, body(z.object({ name: z.string().trim().min(1).max(80), lang: z.enum(['en', 'hi', 'te']).default('en') })), wrap(async (req, res) => {
  const text = await groq(MED_SYS + LANG[req.data.lang] + '.', `Tell me about this medicine: ${req.data.name}`);
  res.json({ info: text || 'Please ask your doctor or pharmacist about this medicine.' });
}));

// ---------- Missed-dose check (alerts consenting caregivers) ----------
function notify(userId, text) {
  // TODO: send SMS/push here (Twilio, MSG91, FCM). For now it is logged on the server only.
  console.log(`[notify ${userId}] ${text}`);
}
async function checkMissed() {
  const due = await q(`select m.id,m.name,m.user_id,u.name as who from medicines m join users u on u.id=m.user_id
    where m.active and m.time_of_day::time <= time '22:59'
    and (m.time_of_day::time + interval '60 minutes') < ((now() at time zone 'Asia/Kolkata')::time)
    and not exists (select 1 from med_logs l where l.medicine_id=m.id and l.day=${TODAY})
    and not exists (select 1 from missed_alerts a where a.medicine_id=m.id and a.day=${TODAY})`);
  for (const m of due.rows) {
    await q(`insert into missed_alerts(medicine_id,day) values($1,${TODAY}) on conflict do nothing`, [m.id]);
    const links = await q("select caregiver_id from caregiver_links where elder_id=$1 and status='active' and view_meds", [m.user_id]);
    for (const l of links.rows) {
      notify(l.caregiver_id, `${m.who} has not taken ${m.name} yet.`);
      await audit(m.user_id, m.user_id, 'missed_dose_alert_sent');
    }
  }
}
setInterval(() => checkMissed().catch((e) => console.error('missed check:', e.message)), 10 * 60 * 1000).unref();

app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));
app.use((err, _req, res, _next) => {
  console.error(err.message); // never send internals to the client
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

app.listen(PORT, () => console.log(`Socio Care API on ${PORT}`));
