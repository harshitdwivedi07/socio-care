import React, { useCallback, useContext, useEffect, useState } from 'react';
import { View, Linking, Platform } from 'react-native';
import * as Speech from 'expo-speech';
import * as Location from 'expo-location';
import { api } from './api';
import { Btn, Card, Err, Field, Prefs, Screen, Txt, useT } from './ui';

function useLoad(path) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => api(path).then(setData).catch((e) => setErr(e.message)), [path]);
  useEffect(() => { load(); }, [load]);
  return [data, load, err];
}
function useAction(after) {
  const [err, setErr] = useState('');
  const run = async (fn) => { setErr(''); try { await fn(); after && (await after()); } catch (e) { setErr(e.message); } };
  return [err, run, setErr];
}
function MedCard({ med, onTake, lang }) {
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const ask = async () => {
    if (info) { setInfo(''); return; }
    setLoading(true);
    try { const r = await api('/medicine-info', { method: 'POST', body: { name: med.name, lang } }); setInfo(r.info); }
    catch (e) { setInfo('Could not load info. Please try again.'); }
    setLoading(false);
  };
  return (
    <Card>
      <Txt bold size={20}>{med.name}</Txt>
      <Txt mute>{med.time_of_day}{med.note ? ' · ' + med.note : ''}</Txt>
      <View style={{ marginTop: 10, flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {med.taken ? <Txt bold>✓ Taken today</Txt> : <Btn kind="pri" small title="I took it" onPress={onTake} />}
        <Btn small title={loading ? '...' : info ? 'Hide info' : '🤖 Ask AI'} onPress={ask} />
      </View>
      {!!info && <Txt style={{ marginTop: 10, lineHeight: 24 }}>{info}</Txt>}
    </Card>
  );
}
export function Meds({ back }) {
  const t = useT();
  const { lang } = useContext(Prefs);
  const [list, load, lerr] = useLoad('/medicines');
  const [err, run, setErr] = useAction(load);
  const [name, setName] = useState(''); const [time, setTime] = useState('08:00');
  const add = () => {
    if (!name.trim()) return setErr('Enter the medicine name.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return setErr('Time must look like 08:30 (24-hour).');
    run(async () => { await api('/medicines', { method: 'POST', body: { name: name.trim(), time_of_day: time } }); setName(''); });
  };
  return (
    <Screen title={t('meds')} onBack={back}>
      <Err msg={lerr} />
      {list?.length === 0 && <Txt mute>No medicines yet. Add your first one below.</Txt>}
        {list?.map((m) => (
        <MedCard key={m.id} med={m} onTake={() => run(() => api(`/medicines/${m.id}/taken`, { method: 'POST' }))} lang={lang} />
      ))}
      <Txt bold size={22} style={{ marginTop: 20 }}>Add a medicine</Txt>
      <Field label="Name and dose" value={name} onChangeText={setName} maxLength={80} />
      <Field label="Time (24-hour, like 08:30)" value={time} onChangeText={setTime} maxLength={5} />
      <Err msg={err} />
      <Btn kind="pri" title="Save medicine" onPress={add} style={{ marginTop: 14 }} />
    </Screen>
  );
}

export function Appts({ back }) {
  const t = useT();
  const [list, load, lerr] = useLoad('/appointments');
  const [err, run, setErr] = useAction(load);
  const [doc, setDoc] = useState(''); const [date, setDate] = useState(''); const [time, setTime] = useState('10:00');
  const add = () => {
    if (!doc.trim()) return setErr('Enter the doctor’s name.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return setErr('Use date 2026-12-31 and time 10:30.');
    const at = new Date(`${date}T${time}:00+05:30`);
    if (isNaN(at) || at < new Date()) return setErr('Choose a date and time in the future.');
    run(async () => { await api('/appointments', { method: 'POST', body: { doctor: doc.trim(), at: at.toISOString() } }); setDoc(''); });
  };
  return (
    <Screen title={t('appts')} onBack={back}>
      <Err msg={lerr} />
      {list?.length === 0 && <Txt mute>No appointments yet.</Txt>}
      {list?.map((a) => (
        <Card key={a.id}>
          <Txt bold size={20}>{a.doctor}</Txt>
          <Txt mute>{new Date(a.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</Txt>
        </Card>
      ))}
      <Txt bold size={22} style={{ marginTop: 20 }}>Book a visit</Txt>
      <Field label="Doctor" value={doc} onChangeText={setDoc} maxLength={80} />
      <Field label="Date (year-month-day)" value={date} onChangeText={setDate} maxLength={10} placeholder="2026-12-31" />
      <Field label="Time (24-hour)" value={time} onChangeText={setTime} maxLength={5} />
      <Err msg={err} />
      <Btn kind="pri" title="Book appointment" onPress={add} style={{ marginTop: 14 }} />
    </Screen>
  );
}

export function SOS({ back }) {
  const t = useT();
  const [contacts, load] = useLoad('/sos/contacts');
  const [err, run, setErr] = useAction(load);
  const [n, setN] = useState(null); const [done, setDone] = useState('');
  const [name, setName] = useState(''); const [phone, setPhone] = useState('');
  useEffect(() => {
    if (n === null) return;
    if (n <= 0) { send(); return; }
    const id = setTimeout(() => setN(n - 1), 1000);
    return () => clearTimeout(id);
  }, [n]);
  async function send() {
    setN(null);
    let pos = {};
    try {
      const p = await Location.requestForegroundPermissionsAsync();
      if (p.granted) { const l = await Location.getCurrentPositionAsync({}); pos = { lat: l.coords.latitude, lng: l.coords.longitude }; }
    } catch {}
    try { const r = await api('/sos', { method: 'POST', body: pos }); setDone(`Alert sent. ${r.notified} contact(s) will be told.`); } catch (e) { setErr(e.message); }
  }
  const add = () => {
    if (name.trim().length < 2) return setErr('Enter a name.');
    if (!/^[6-9]\d{9}$/.test(phone)) return setErr('Enter a valid 10-digit mobile number.');
    run(async () => { await api('/sos/contacts', { method: 'POST', body: { name: name.trim(), phone } }); setName(''); setPhone(''); });
  };
  return (
    <Screen title={t('sos')} onBack={back}>
      {n !== null ? (
        <View style={{ alignItems: 'center' }}>
          <Txt>Sending your alert in</Txt>
          <Txt size={80} bold>{n}</Txt>
          <Btn title="Cancel" onPress={() => setN(null)} style={{ alignSelf: 'stretch' }} />
        </View>
      ) : (
        <View style={{ alignItems: 'center' }}>
          <Txt style={{ textAlign: 'center' }}>Press if you need urgent help. You have 5 seconds to cancel.</Txt>
          <Btn kind="pri" title="SOS" onPress={() => { setDone(''); setErr(''); setN(5); }} style={{ width: 220, height: 220, borderRadius: 110, marginVertical: 24 }} />
          {!!done && <Txt bold>{done}</Txt>}
          <Btn title="Call 112" onPress={() => Linking.openURL('tel:112')} style={{ alignSelf: 'stretch' }} />
        </View>
      )}
      <Txt bold size={22} style={{ marginTop: 28 }}>People to alert</Txt>
      {contacts?.length === 0 && <Txt mute>Add at least one person.</Txt>}
      {contacts?.map((c) => (
        <Card key={c.id}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View><Txt bold>{c.name}</Txt><Txt mute>+91 {c.phone}</Txt></View>
          <Btn small title="Remove" onPress={() => run(() => api('/sos/contacts/' + c.id, { method: 'DELETE' }))} />
        </View></Card>
      ))}
      <Field label="Name and relation" value={name} onChangeText={setName} maxLength={40} />
      <Field label="Mobile number" value={phone} onChangeText={setPhone} keyboardType="number-pad" maxLength={10} />
      <Err msg={err} />
      <Btn kind="pri" title="Add person" onPress={add} style={{ marginTop: 14 }} />
    </Screen>
  );
}

export function Family({ back }) {
  const t = useT();
  const [d, load, lerr] = useLoad('/caregivers');
  const [err, run] = useAction(load);
  const [meds, setMeds] = useState(true); const [appts, setAppts] = useState(false);
  const [code, setCode] = useState(''); const [entered, setEntered] = useState('');
  const [care, setCare] = useState(null);
  const flag = (l, k) => run(() => api('/caregivers/' + l.id, { method: 'PATCH', body: { view_meds: k === 'm' ? !l.view_meds : l.view_meds, view_appts: k === 'a' ? !l.view_appts : l.view_appts } }));
  return (
    <Screen title={t('family')} onBack={back}>
      <Err msg={lerr || err} />
      <Txt bold size={22}>People who can see my reminders</Txt>
      {d?.my_caregivers.length === 0 && <Txt mute>Nobody yet. You decide who sees what.</Txt>}
      {d?.my_caregivers.map((l) => (
        <Card key={l.id}>
          <Txt bold>{l.name || 'Invite waiting to be used'}</Txt>
          {l.status === 'active' && <View style={{ gap: 8, marginTop: 10 }}>
            <Btn small kind={l.view_meds ? 'pri' : undefined} title={'Medicines: ' + (l.view_meds ? 'allowed' : 'off')} onPress={() => flag(l, 'm')} />
            <Btn small kind={l.view_appts ? 'pri' : undefined} title={'Appointments: ' + (l.view_appts ? 'allowed' : 'off')} onPress={() => flag(l, 'a')} />
          </View>}
          <Btn small title="Remove access" onPress={() => run(() => api('/caregivers/' + l.id, { method: 'DELETE' }))} style={{ marginTop: 10 }} />
        </Card>
      ))}
      <Txt bold size={20} style={{ marginTop: 16 }}>Invite a family member</Txt>
      <View style={{ gap: 8, marginTop: 8 }}>
        <Btn small kind={meds ? 'pri' : undefined} title={'Can see medicines: ' + (meds ? 'yes' : 'no')} onPress={() => setMeds(!meds)} />
        <Btn small kind={appts ? 'pri' : undefined} title={'Can see appointments: ' + (appts ? 'yes' : 'no')} onPress={() => setAppts(!appts)} />
        <Btn kind="pri" title="Create invite code" onPress={() => run(async () => { const r = await api('/caregivers/invite', { method: 'POST', body: { view_meds: meds, view_appts: appts } }); setCode(r.code); })} />
      </View>
      {!!code && <Card style={{ marginTop: 12 }}><Txt>Share this code. It works once and expires in 48 hours.</Txt><Txt bold size={28} selectable>{code}</Txt></Card>}

      <Txt bold size={22} style={{ marginTop: 28 }}>I care for someone</Txt>
      <Field label="Invite code" value={entered} onChangeText={setEntered} autoCapitalize="none" maxLength={12} />
      <Btn kind="pri" title="Connect" style={{ marginTop: 12 }} onPress={() => run(async () => { await api('/caregivers/redeem', { method: 'POST', body: { code: entered.trim().toLowerCase() } }); setEntered(''); })} />
      {d?.people_i_care_for.map((p) => (
        <Card key={p.id} style={{ marginTop: 12 }}>
          <Txt bold>{p.name}</Txt>
          {p.view_meds ? <Btn small title="See today’s medicines" style={{ marginTop: 8 }} onPress={() => run(async () => setCare({ name: p.name, rows: await api(`/care/${p.elder_id}/medicines`) }))} /> : <Txt mute>Medicines not shared.</Txt>}
        </Card>
      ))}
      {care && <Card><Txt bold>{care.name}: today</Txt>{care.rows.map((r, i) => <Txt key={i}>{r.taken ? '✓' : '○'} {r.name} · {r.time_of_day}</Txt>)}</Card>}
    </Screen>
  );
}

export function Health({ back }) {
  const t = useT();
  const [list, load, lerr] = useLoad('/readings');
  const [err, run, setErr] = useAction(load);
  const [kind, setKind] = useState('sugar'); const [val, setVal] = useState('');
  const label = { bp: 'Blood pressure', sugar: 'Blood sugar', weight: 'Weight' };
  const save = () => {
    if (!val.trim()) return setErr('Enter a value.');
    run(async () => { await api('/readings', { method: 'POST', body: { kind, value: val.trim() } }); setVal(''); });
  };
  return (
    <Screen title={t('health')} onBack={back}>
      <Err msg={lerr} />
      {list?.map((r) => (
        <Card key={r.id}><Txt bold>{label[r.kind]}: {r.value}</Txt><Txt mute>{new Date(r.taken_at).toLocaleDateString('en-IN')}</Txt></Card>
      ))}
      <Txt bold size={22} style={{ marginTop: 20 }}>Add a reading</Txt>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {Object.keys(label).map((k) => <Btn key={k} small kind={kind === k ? 'pri' : undefined} title={label[k]} onPress={() => setKind(k)} />)}
      </View>
      <Field label={kind === 'bp' ? 'Value (like 120/80)' : kind === 'sugar' ? 'Value (mg/dL)' : 'Value (kg)'} value={val} onChangeText={setVal} maxLength={7} />
      <Err msg={err} />
      <Btn kind="pri" title="Save reading" onPress={save} style={{ marginTop: 14 }} />
    </Screen>
  );
}

export function Helper({ back }) {
  const t = useT();
  const { lang } = useContext(Prefs);
  const [msgs, setMsgs] = useState([{ me: false, t: 'Hello! Ask me how to use the app, or for a gentle health tip.' }]);
  const [q, setQ] = useState(''); const [busy, setBusy] = useState(false);
  const locale = lang === 'hi' ? 'hi-IN' : lang === 'te' ? 'te-IN' : 'en-IN';
  const ask = async (text) => {
    const m = (text ?? q).trim();
    if (!m) return;
    setQ(''); setMsgs((x) => [...x, { me: true, t: m }]); setBusy(true);
    try { const r = await api('/assistant', { method: 'POST', body: { message: m, lang } }); setMsgs((x) => [...x, { me: false, t: r.reply }]); }
    catch (e) { setMsgs((x) => [...x, { me: false, t: e.message }]); }
    setBusy(false);
  };
  const SR = Platform.OS === 'web' && typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  const listen = () => { try { const r = new SR(); r.lang = locale; r.onresult = (e) => ask(e.results[0][0].transcript); r.start(); } catch {} };
  return (
    <Screen title={t('helper')} onBack={back}>
      {msgs.map((m, i) => (
        <View key={i} style={{ alignSelf: m.me ? 'flex-end' : 'flex-start', maxWidth: '90%', marginBottom: 10 }}>
          <Card style={{ marginBottom: 0, backgroundColor: m.me ? '#fff' : '#121212' }}>
            <Txt style={{ color: m.me ? '#000' : '#fff' }}>{m.t}</Txt>
            {!m.me && <Btn small title="🔊 Read aloud" onPress={() => Speech.speak(m.t, { language: locale })} style={{ marginTop: 8, alignSelf: 'flex-start' }} />}
          </Card>
        </View>
      ))}
      {busy && <Txt mute>Thinking…</Txt>}
      <Field label="Ask a question" value={q} onChangeText={setQ} maxLength={300} onSubmitEditing={() => ask()} />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <Btn kind="pri" title="Send" onPress={() => ask()} style={{ flex: 1 }} />
        {SR && <Btn title="🎤 Speak" onPress={listen} />}
      </View>
      <Txt mute size={14} style={{ marginTop: 14 }}>The helper gives general tips only. It cannot diagnose or change your medicines. In an emergency press SOS or call 112.</Txt>
    </Screen>
  );
}
