import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Platform, Animated, Easing, Dimensions } from 'react-native';

export const C = { bg: '#000', fg: '#fff', mute: '#a8a8a8', line: 'rgba(255,255,255,0.22)', card: 'transparent' };
const web = Platform.OS === 'web';

// Web fonts (needs internet; falls back to system fonts if offline)
if (web && typeof document !== 'undefined' && !document.getElementById('sc-fonts')) {
  const l = document.createElement('link');
  l.id = 'sc-fonts';
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;600;800&family=Instrument+Serif:ital@1&display=swap';
  document.head.appendChild(l);
}
const font = web ? { fontFamily: "'Inter Tight', system-ui, sans-serif" } : {};
const serifFont = web
  ? { fontFamily: "'Instrument Serif', Georgia, serif" }
  : { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' };

export const STR = {
  en: { hello: 'Hello', meds: 'Medicines', appts: 'Appointments', sos: 'Emergency SOS', family: 'Family', health: 'Health log', settings: 'Settings', helper: 'Helper', home: 'Home', signin: 'Sign in', register: 'Create account', out: 'Sign out' },
  hi: { hello: 'नमस्ते', meds: 'दवाइयाँ', appts: 'अपॉइंटमेंट', sos: 'आपातकालीन SOS', family: 'परिवार', health: 'स्वास्थ्य रिकॉर्ड', settings: 'सेटिंग', helper: 'सहायक', home: 'होम', signin: 'साइन इन', register: 'खाता बनाएँ', out: 'साइन आउट' },
  te: { hello: 'నమస్కారం', meds: 'మందులు', appts: 'అపాయింట్‌మెంట్లు', sos: 'అత్యవసర SOS', family: 'కుటుంబం', health: 'ఆరోగ్య నమోదు', settings: 'సెట్టింగ్‌లు', helper: 'సహాయకుడు', home: 'హోమ్', signin: 'సైన్ ఇన్', register: 'ఖాతా సృష్టించండి', out: 'సైన్ అవుట్' },
};

export const Prefs = createContext({ lang: 'en', size: 1, set: () => {} });
export const useT = () => { const p = useContext(Prefs); return (k) => STR[p.lang][k] || STR.en[k]; };

export function Txt({ style, size = 18, bold, mute, serif, upper, children, ...p }) {
  const { size: s } = useContext(Prefs);
  return (
    <Text {...p} style={[
      serif ? serifFont : font,
      { color: mute ? C.mute : C.fg, fontSize: size * s, fontWeight: bold ? '700' : '400' },
      serif && { fontStyle: 'italic', fontWeight: '400' },
      upper && { textTransform: 'uppercase', letterSpacing: 1 },
      style,
    ]}>{children}</Text>
  );
}

export const H1 = ({ children }) => (
  <Txt size={44} bold upper style={{ marginVertical: 14, letterSpacing: -1 }} accessibilityRole="header">{children}</Txt>
);

export function Btn({ title, onPress, kind, small, style, ...p }) {
  const pri = kind === 'pri';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} {...p}
      style={({ pressed, hovered }) => [{
        minHeight: small ? 44 : 58, paddingHorizontal: 24, borderRadius: 999, borderWidth: 1.5, borderColor: C.fg,
        backgroundColor: pri || hovered ? C.fg : 'transparent',
        alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1,
      }, style]}>
      {({ hovered }) => (
        <Txt bold upper size={small ? 15 : 17} style={{ color: pri || hovered ? '#000' : C.fg }}>{title}</Txt>
      )}
    </Pressable>
  );
}

export function Field({ label, error, onFocus, onBlur, ...p }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ marginTop: 24 }}>
      <Txt mute upper size={13} style={{ letterSpacing: 2 }}>{label}</Txt>
      <TextInput {...p} accessibilityLabel={label} placeholderTextColor="#666"
        onFocus={(e) => { setFocus(true); onFocus && onFocus(e); }}
        onBlur={(e) => { setFocus(false); onBlur && onBlur(e); }}
        style={[font, {
          minHeight: 56, color: C.fg, fontSize: 22, paddingVertical: 8,
          borderBottomWidth: focus ? 2 : 1, borderBottomColor: focus ? C.fg : 'rgba(255,255,255,0.4)',
        }, web ? { outlineStyle: 'none' } : {}]} />
    </View>
  );
}

export const Card = ({ children, style }) => (
  <View style={[{ borderTopWidth: 1, borderTopColor: C.line, paddingVertical: 18, marginBottom: 4 }, style]}>{children}</View>
);

export const Err = ({ msg }) => (msg ? <Txt bold accessibilityLiveRegion="polite" style={{ marginTop: 12 }}>⚠ {msg}</Txt> : null);

// ---------- Mirror loading (light sweep across a dark bar) ----------
export function Shimmer({ width = '100%', height = 20, radius = 6, style }) {
  const x = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(x, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: !web })
    );
    loop.start();
    return () => loop.stop();
  }, [x]);
  const tx = x.interpolate({ inputRange: [0, 1], outputRange: [-140, Math.max(w, 140) + 140] });
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} accessibilityRole="progressbar" accessibilityLabel="Loading"
      style={[{ width, height, borderRadius: radius, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: C.line }, style]}>
      <Animated.View style={{ position: 'absolute', top: -12, bottom: -12, width: 110, flexDirection: 'row', transform: [{ translateX: tx }, { rotate: '18deg' }] }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <View style={{ width: 6, backgroundColor: 'rgba(255,255,255,0.38)' }} />
        <View style={{ width: 22, backgroundColor: 'rgba(255,255,255,0.08)' }} />
      </Animated.View>
    </View>
  );
}

// ---------- Preloader: big counter, then the black screen slides up ----------
export function Preloader({ ready, onDone }) {
  const [n, setN] = useState(0);
  const y = useRef(new Animated.Value(0)).current;
  const H = Dimensions.get('window').height;
  useEffect(() => {
    const id = setInterval(() => setN((v) => Math.min(ready ? 100 : 88, v + (ready ? 3 : 1))), 25);
    return () => clearInterval(id);
  }, [ready]);
  const full = n >= 100;
  useEffect(() => {
    if (full) {
      Animated.timing(y, { toValue: -H, duration: 700, delay: 300, easing: Easing.inOut(Easing.cubic), useNativeDriver: !web })
        .start(() => onDone && onDone());
    }
  }, [full]);
  return (
    <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99, backgroundColor: '#000', justifyContent: 'space-between', padding: 24, paddingTop: 40, transform: [{ translateY: y }] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Txt upper size={14} style={{ letterSpacing: 2 }}>Socio Care ©</Txt>
        <Txt mute upper size={14} style={{ letterSpacing: 2 }}>Loading</Txt>
      </View>
      <View>
        <Txt serif mute size={30}>Care, health & family.</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <Txt bold style={{ fontSize: 120, lineHeight: 125, letterSpacing: -4 }}>{n}</Txt>
          <Txt serif style={{ fontSize: 44, marginBottom: 18, marginLeft: 6 }}>%</Txt>
        </View>
        <View style={{ height: 2, backgroundColor: 'rgba(255,255,255,0.18)', marginTop: 12 }}>
          <View style={{ height: 2, width: `${n}%`, backgroundColor: '#fff' }} />
        </View>
      </View>
    </Animated.View>
  );
}

export function Screen({ title, onBack, children }) {
  const t = useT();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 22, paddingTop: 40, paddingBottom: 60, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Txt mute upper size={13} style={{ letterSpacing: 2 }}>Socio Care ©</Txt>
        {onBack ? <Btn small title={'← ' + t('home')} onPress={onBack} /> : <Txt mute size={13}>{new Date().getFullYear()}</Txt>}
      </View>
      {title && <H1>{title}</H1>}
      {children}
    </ScrollView>
  );
}