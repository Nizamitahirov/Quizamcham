#!/usr/bin/env node
/**
 * Yük testi: N bot oyunçu PIN ilə qoşulur və hər suala təsadüfi vaxtda cavab verir.
 *   NODE_USE_ENV_PROXY=1 node scripts/load-test.mjs <PIN> [N=40]
 * Host ekranı açıq olmalıdır (oyunu host başladır və idarə edir).
 * Bitəndə: qoşulan, cavab verən, rədd edilən cavablar, orta gecikmə statistikası çap olunur.
 */
import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously, inMemoryPersistence, setPersistence } from 'firebase/auth'
import { getFirestore, doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'

const PIN = process.argv[2]
const N = Number(process.argv[3] ?? 40)
if (!PIN) { console.error('İstifadə: node scripts/load-test.mjs <PIN> [N]'); process.exit(1) }
const config = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyB3alay5Ai52FrNOPpyVyFgHG5Qapvgwcs',
  authDomain: 'birsual.firebaseapp.com', projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'birsual',
  appId: '1:31059802078:web:03428444b45eac9a714f4f',
}
const NAMES = ['Aysel', 'Murad', 'Leyla', 'Tural', 'Nigar', 'Elvin', 'Günay', 'Rauf', 'Səbinə', 'Kamran', 'Lalə', 'Orxan']
const stats = { joined: 0, answers: 0, rejected: 0, latency: [], phases: 0, finished: 0 }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function bot(i) {
  const app = initializeApp(config, `bot${i}`)
  const auth = getAuth(app)
  await setPersistence(auth, inMemoryPersistence)
  const { user } = await signInAnonymously(auth)
  const db = getFirestore(app)
  const pin = await getDoc(doc(db, 'pins', PIN))
  if (!pin.exists()) throw new Error('PIN tapılmadı')
  const gameId = pin.get('gameId')
  await setDoc(doc(db, 'games', gameId, 'players', user.uid), {
    firstName: NAMES[i % NAMES.length], lastName: `Bot${i}`, avatar: { style: ['fun-emoji', 'adventurer', 'bottts'][i % 3], seed: `bot${i}` },
    joinedAt: serverTimestamp(), lastSeen: serverTimestamp(), kicked: false, score: 0, correctCount: 0, streak: 0, bestStreak: 0,
    totalCorrectTimeMs: 0, lastResult: null, history: [], powerups: { fifty: 1, double: 1, shield: 1 }, power: null, fiftyHide: null,
  })
  stats.joined++
  let answered = -1
  await new Promise((resolve) => {
    const unsub = onSnapshot(doc(db, 'games', gameId), async (s) => {
      const g = s.data()
      if (!g) return
      stats.phases++
      if (g.phase === 'finished') { stats.finished++; unsub(); resolve(); return }
      if (g.phase === 'question' && g.questionEndsAt && g.currentQuestion && answered !== g.questionIndex && g.currentQuestion.type !== 'slide') {
        const qi = g.questionIndex
        answered = qi
        const q = g.currentQuestion
        await sleep(400 + Math.random() * Math.min(8000, q.timeLimit * 600))
        const value = q.options?.length ? [q.options[Math.floor(Math.random() * q.options.length)].id] : q.type === 'slider' ? q.slider?.min ?? 0 : 'attention'
        const t0 = Date.now()
        try {
          await setDoc(doc(db, 'games', gameId, 'answers', `${user.uid}_${qi}`), { uid: user.uid, questionIndex: qi, value, answeredAt: serverTimestamp() })
          stats.answers++
          stats.latency.push(Date.now() - t0)
        } catch { stats.rejected++ }
      }
    })
  })
}

const started = Date.now()
const timer = setInterval(() => console.log(`⏱ ${Math.round((Date.now() - started) / 1000)}s · qoşulub ${stats.joined}/${N} · cavab ${stats.answers} · rədd ${stats.rejected} · bitən ${stats.finished}`), 10000)
const results = await Promise.allSettled(Array.from({ length: N }, (_, i) => sleep(i * 120).then(() => bot(i))))
clearInterval(timer)
const lat = stats.latency.sort((a, b) => a - b)
const pct = (p) => lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * p))] : 0
console.log(JSON.stringify({
  bots: N, joined: stats.joined, answers: stats.answers, rejected: stats.rejected, failedBots: results.filter((r) => r.status === 'rejected').length,
  answerWriteMs: { p50: pct(0.5), p95: pct(0.95), max: lat.at(-1) ?? 0 }, gameSnapshotsReceived: stats.phases, durationSec: Math.round((Date.now() - started) / 1000),
}, null, 2))
results.filter((r) => r.status === 'rejected').slice(0, 3).forEach((r) => console.error(r.reason?.message ?? r.reason))
process.exit(0)
