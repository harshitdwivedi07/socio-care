import React, { useEffect, useMemo, useState } from 'react';
import { View, Pressable, StatusBar } from 'react-native';
import { api, kv, loadTokens, signIn, signOut, onLost } from './src/api';
import { syncReminders } from './src/reminders';
import { Btn, C, Err, Field, Prefs, STR, Screen, Txt, useT, Shimmer, Preloader } from './src/ui';
import { Meds, Appts, SOS, Family, Health, Helper } from './src/screens';

function Auth({ done }) {
  const t = useT();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async () => {
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) return setErr('Enter a valid email address.');
    if (pw.length < 10) return setErr('Use a password with at least 10 characters.');
    if (mode === 'register' && !name.trim()) return setErr('Enter your name.');
    setBusy(true); setErr('');
    try { await signIn(mode, mode === 'register' ? { email: e, password: pw, name: name.trim() } : { email: e, password: pw }); done(); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return (
    <Screen>
      <Txt size={64} bold upper style={{ marginTop: 40, letterSpacing: -2 }}>Socio</Txt>
      <Txt serif size={72} style={{ marginTop: -12 }}>care</Txt>
      <Txt mute style={{ marginTop: 12 }}>Your day, your health, your family. Made simple.</Txt>
      {mode === 'register' && <Field label="Your name" value={name} onChangeText={setName} maxLength={60} />}
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" maxLength={120} />
      <Field label="Password (10+ characters)" value={pw} onChangeText={setPw} secureTextEntry autoComplete="password" maxLength={128} />
      <Err msg={err} />
      {busy
        ? <Shimmer height={58} radius={29} style={{ marginTop: 24 }} />
        : <Btn kind="pri" title={mode === 'login' ? t('signin') : t('register')} onPress={submit} style={{ marginTop: 24 }} />}
      <Btn small title={mode === 'login' ? t('register') : t('signin')} onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }} style={{ marginTop: 12 }} />
    </Screen>
  );
}

function Row({ n, label, onPress, hot }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed, hovered }) => ({
        flexDirection: 'row', alignItems: 'center', paddingVertical: 24, paddingHorizontal: 12,
        borderTopWidth: 1, borderTopColor: C.line,
        backgroundColor: hot ? C.fg : hovered ? 'rgba(255,255,255,0.08)' : 'transparent',
        opacity: pressed ? 0.7 : 1,
      })}>
      <Txt mute size={15} style={{ width: 44, color: hot ? '#000' : undefined }}>{n}</Txt>
      <Txt bold upper size={22} style={{ flex: 1, letterSpacing: -0.3, color: hot ? '#000' : C.fg }}>{label}</Txt>
      <Txt size={24} style={{ color: hot ? '#000' : C.fg }}>→</Txt>
    </Pressable>
  );
}

function Home({ go, name }) {
  const t = useT();
  const [next, setNext] = useState(null);
  useEffect(() => { Promise.all([api('/medicines'), api('/appointments')]).then(([m, a]) => { setNext(m.find((x) => !x.taken) || false); syncReminders(m, a); }).catch(() => {}); }, []);
  return (
    <Screen>
      <View style={{ marginBottom: 20 }}>
        <Txt size={44} bold upper style={{ letterSpacing: -1 }}>{t('hello')},</Txt>
        <Txt serif size={56} style={{ marginTop: -4 }}>{name}</Txt>
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: C.fg, paddingVertical: 18, marginBottom: 28 }}>
        <Txt mute upper size={13} style={{ letterSpacing: 2 }}>(Up next)</Txt>
        {next === null
          ? <Shimmer height={30} width="70%" style={{ marginTop: 12 }} />
          : <Txt bold size={26} style={{ marginTop: 8 }}>{next ? `${next.name} · ${next.time_of_day}` : 'All medicines taken today ✓'}</Txt>}
      </View>
      <View style={{ borderBottomWidth: 1, borderBottomColor: C.line }}>
        <Row hot n="01" label={t('sos')} onPress={() => go('sos')} />
        <Row n="02" label={t('meds')} onPress={() => go('meds')} />
        <Row n="03" label={t('appts')} onPress={() => go('appts')} />
        <Row n="04" label={t('family')} onPress={() => go('family')} />
        <Row n="05" label={t('health')} onPress={() => go('health')} />
        <Row n="06" label={t('helper')} onPress={() => go('helper')} />
        <Row n="07" label={t('settings')} onPress={() => go('settings')} />
      </View>
    </Screen>
  );
}

function Settings({ back, out }) {
  const t = useT();
  const p = React.useContext(Prefs);
  const [sure, setSure] = useState(false); const [err, setErr] = useState('');
  const row = (items, cur, fn) => (
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
      {items.map(([v, l]) => <Btn key={String(v)} small kind={cur === v ? 'pri' : undefined} title={l} onPress={() => fn(v)} />)}
    </View>
  );
  return (
    <Screen title={t('settings')} onBack={back}>
      <Txt bold size={22} style={{ marginTop: 12 }}>Language</Txt>
      {row([['en', 'English'], ['hi', 'हिन्दी'], ['te', 'తెలుగు']], p.lang, (v) => p.set({ lang: v }))}
      <Txt bold size={22} style={{ marginTop: 24 }}>Text size</Txt>
      {row([[1, 'Normal'], [1.2, 'Large'], [1.4, 'Extra large']], p.size, (v) => p.set({ size: v }))}
      <Btn title={t('out')} onPress={out} style={{ marginTop: 32 }} />
      <Txt bold size={22} style={{ marginTop: 32 }}>Delete my account</Txt>
      <Txt mute>This permanently removes all your data.</Txt>
      <Err msg={err} />
      {!sure ? <Btn small title="Delete account" onPress={() => setSure(true)} style={{ marginTop: 10 }} />
        : <Btn kind="pri" title="Yes, delete everything" onPress={async () => { try { await api('/me', { method: 'DELETE' }); await signOut(); out(); } catch (e) { setErr(e.message); } }} style={{ marginTop: 10 }} />}
    </Screen>
  );
}

export default function App() {
  const [prefs, setPrefs] = useState({ lang: 'en', size: 1 });
  const [state, setState] = useState('boot'); // boot | out | in
  const [loaded, setLoaded] = useState(false); // preloader finished
  const [screen, setScreen] = useState('home');
  const [name, setName] = useState('');
  const ctx = useMemo(() => ({ ...prefs, set: (p) => setPrefs((o) => { const n = { ...o, ...p }; try { kv.set('prefs', JSON.stringify(n)); } catch {} return n; }) }), [prefs]);
  const enter = async () => { try { const me = await api('/me'); setName(me.name); setScreen('home'); setState('in'); } catch { setState('out'); } };
  const leave = async () => { await signOut(); setState('out'); };
  useEffect(() => { kv.get('prefs').then((s) => { try { const p = JSON.parse(s); if (STR[p.lang] && [1, 1.2, 1.4].includes(p.size)) setPrefs(p); } catch {} }).catch(() => {}); onLost(() => setState('out')); loadTokens().then((has) => (has ? enter() : setState('out'))); }, []);

  const back = () => setScreen('home');
  const views = { home: <Home go={setScreen} name={name} />, meds: <Meds back={back} />, appts: <Appts back={back} />, sos: <SOS back={back} />, family: <Family back={back} />, health: <Health back={back} />, helper: <Helper back={back} />, settings: <Settings back={back} out={leave} /> };
  return (
    <Prefs.Provider value={ctx}>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {state === 'boot' ? null : state === 'out' ? <Auth done={enter} /> : views[screen]}
        {!loaded && <Preloader ready={state !== 'boot'} onDone={() => setLoaded(true)} />}
      </View>
    </Prefs.Provider>
  );
}