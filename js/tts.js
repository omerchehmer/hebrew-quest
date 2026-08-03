// tts.js — הקראה בעברית. באייפון הקול Carmit מובנה.
// שתי מלכודות מוכרות: (1) iOS חוסם דיבור שלא נובע ממחווה — לכן warmup();
// (2) מילים לא מנוקדות נקראות לפעמים שגוי — לכן כל פריט דיקטה נושא שדה say מנוקד.

const synth = window.speechSynthesis;

let hebVoice = null;
let ready = false;
let warmed = false;

function pickVoice() {
  if (!synth) return null;
  const voices = synth.getVoices() || [];
  const he = voices.filter((v) => /^he/i.test(v.lang) || /iw/i.test(v.lang));
  if (!he.length) return null;
  // Carmit היא ברירת המחדל באייפון ונשמעת הכי טבעית
  return he.find((v) => /carmit/i.test(v.name)) || he[0];
}

export function initTTS() {
  if (!synth) return Promise.resolve(false);
  return new Promise((resolve) => {
    const settle = () => {
      hebVoice = pickVoice();
      ready = true;
      resolve(!!hebVoice);
    };
    const v = synth.getVoices();
    if (v && v.length) return settle();
    let done = false;
    synth.addEventListener('voiceschanged', () => {
      if (done) return;
      done = true;
      settle();
    });
    setTimeout(() => {
      if (done) return;
      done = true;
      settle();
    }, 1200);
  });
}

// חייב להיקרא מתוך מחווה של המשתמש (הלחיצה הראשונה במסך הפתיחה)
export function warmup() {
  if (!synth || warmed) return;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    synth.speak(u);
    warmed = true;
  } catch (_) {}
}

export function hasHebrewVoice() {
  return !!hebVoice;
}

export function isReady() {
  return ready;
}

let lastUtter = null;

export function speak(text, { rate = 0.85, onEnd } = {}) {
  if (!synth || !text) {
    onEnd?.();
    return false;
  }
  try {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = 'he-IL';
    if (hebVoice) u.voice = hebVoice;
    u.rate = rate;
    u.pitch = 1;
    if (onEnd) u.addEventListener('end', onEnd);
    lastUtter = u;
    synth.speak(u);
    return true;
  } catch (e) {
    console.warn('הקראה נכשלה', e);
    onEnd?.();
    return false;
  }
}

export function stopSpeaking() {
  try {
    synth?.cancel();
  } catch (_) {}
  lastUtter = null;
}

// מקריאה רצף משפטים עם הדגשה, ומחזירה פונקציית עצירה
export function speakSequence(sentences, { onSentence, rate = 0.85, onDone } = {}) {
  let i = 0;
  let stopped = false;
  const next = () => {
    if (stopped || i >= sentences.length) {
      if (!stopped) onDone?.();
      return;
    }
    const idx = i++;
    onSentence?.(idx);
    speak(sentences[idx], { rate, onEnd: next });
  };
  next();
  return () => {
    stopped = true;
    stopSpeaking();
  };
}
