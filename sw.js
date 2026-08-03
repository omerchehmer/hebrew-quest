// sw.js — מטמון אופליין. cache-first לנכסים, network-first לנתונים כדי שעדכוני תוכן ייקלטו.

// העלה את המספר בכל פריסה — כך המטמון הישן נמחק.
const VERSION = 'hq-v3';
const SHELL = [
  './',
  './index.html',
  './parent.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/main.js',
  './js/content.js',
  './js/storage.js',
  './js/srs.js',
  './js/tts.js',
  './js/sfx.js',
  './js/ui.js',
  './js/world.js',
  './js/sync.js',
  './js/config.js',
  './js/games/common.js',
  './js/games/spell.js',
  './js/games/vocab.js',
  './js/games/grammar.js',
  './js/games/reading.js',
  './js/games/writing.js',
  './js/games/mixed.js',
  './js/games/boss.js',
  './data/curriculum.json',
  './data/vocab.json',
  './data/grammar.json',
  './data/spelling.json',
  './data/texts.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// network-first עם נפילה למטמון.
// המטען קטן (~300KB) והאפליקציה נפתחת פעם ביום, ולכן עדיפה טריות על פני חיסכון:
// cache-first היה מקפיא את הילד על גרסה ישנה גם אחרי עדכון תוכן.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // סנכרון ל-Supabase לא עובר דרך המטמון

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((hit) => hit || caches.match('./index.html'))
      )
  );
});
