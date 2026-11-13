// Yük testi: N virtual oyunçu (real anonim sessiyalar, HTTP yazılar, WebSocket dinləyicilər — veb klientlə eyni protokol).
// İstifadə: BASE=https://jabr.az node tools/loadtest/players.mjs 1000 <gameId> 60000
//   1) Host ekranında oyunu açın (avtomatik rejim, maxPlayers ≥ N), gameId-ni ünvandan götürün (/host/<gameId>)
//   2) Skripti işə salın, hamı qoşulandan sonra "Başla" basın. Hər 20 san metriklər çap olunur.
//   Diqqət: istehsalda yalnız öz serverinizə qarşı və sakit vaxtda işlədin.
// 1000 virtual players: real anonymous sessions, HTTP writes, WebSocket live listeners (same protocol as the web client)
const BASE = process.env.BASE ?? 'http://127.0.0.1:3100'
const B = BASE, WSU = BASE.replace(/^http/, 'ws') + '/api/ws'
const N = Number(process.argv[2] ?? 1000), GID = process.argv[3], RAMP_MS = Number(process.argv[4] ?? 60000)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))] }
const M = { joinMs: [], joinErr: 0, authErr: 0, wsErr: 0, ansMs: [], ansErr: 0, ansCodes: {}, hbErr: 0, phaseLag: {}, scoreLag: [], disconnects: 0, players: 0 }
async function post(path, body, token) {
  const t0 = Date.now()
  const r = await fetch(B + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  return { ok: r.ok, status: r.status, j, ms: Date.now() - t0 }
}
const SV = { __sv: 'ts' }
async function player(i) {
  const a = await post('/api/auth/anonymous', {})
  if (!a.ok) { M.authErr++; return }
  const token = a.j.token, uid = a.j.user.uid
  const t0 = Date.now()
  const pin = await post('/api/db/get', { path: `games/${GID}` }, token)
  const j = await post('/api/db/commit', { writes: [{ op: 'set', path: `games/${GID}/players/${uid}`, data: {
    firstName: `Oyunçu${i}`, lastName: 'Test', avatar: { style: 'fun-emoji', seed: `p${i}` }, joinedAt: SV, lastSeen: SV, kicked: false,
    score: 0, correctCount: 0, streak: 0, bestStreak: 0, totalCorrectTimeMs: 0, lastResult: null, history: [], powerups: { fifty: 1, double: 1, shield: 1 }, power: null, fiftyHide: null } }] }, token)
  if (!j.ok) { M.joinErr++; if (M.joinErr < 4) console.log('join err', j.status, JSON.stringify(j.j).slice(0, 160)); return }
  M.joinMs.push(Date.now() - t0); M.players++
  const ws = new WebSocket(WSU)
  let lastQ = -1, lastPhase = '', answered = new Set()
  ws.onopen = () => { ws.send(JSON.stringify({ t: 'auth', token })); ws.send(JSON.stringify({ t: 'sub', id: 'g', kind: 'doc', path: `games/${GID}` })); ws.send(JSON.stringify({ t: 'sub', id: 'p', kind: 'doc', path: `games/${GID}/players/${uid}` })) }
  ws.onerror = () => { M.wsErr++ }
  ws.onclose = () => { M.disconnects++ }
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.t === 'doc' && m.id === 'g' && m.data) {
      const g = m.data, key = `${g.phase}:${g.questionIndex}`
      if (key !== lastPhase) {
        lastPhase = key
        // fanout gecikməsi: faza dəyişikliyi (server vaxtı) → bu oyunçuya çatma
        const ref = g.phase === 'question' || g.phase === 'countdown' ? g.questionStartedAt?.__t : null
        ;(M.phaseLag[key] ??= []).push(Date.now())
        if (ref) (M.phaseLag[key + ':ref'] ??= ref)
      }
      if ((g.phase === 'question' || g.phase === 'countdown') && g.currentQuestion && g.questionStartedAt && !answered.has(g.questionIndex)) { // real klient kimi: başlanğıc vaxtı yazılanda
        answered.add(g.questionIndex); lastQ = g.questionIndex
        const startAt = g.questionStartedAt?.__t ?? Date.now()
        const opts = g.currentQuestion.options ?? []
        const value = opts.length ? opts[Math.floor(Math.random() * opts.length)].id : 't'
        const wait = Math.max(0, startAt - Date.now()) + 300 + Math.random() * 5700
        setTimeout(async () => {
          const r = await post('/api/db/commit', { writes: [{ op: 'set', path: `games/${GID}/answers/${uid}_${g.questionIndex}`, data: { uid, questionIndex: g.questionIndex, value, answeredAt: SV } }] }, token)
          if (r.ok) M.ansMs.push(r.ms); else { M.ansErr++; M.ansCodes[r.status] = (M.ansCodes[r.status] ?? 0) + 1; if (M.ansErr <= 3) console.log('ans err', r.status, JSON.stringify(r.j).slice(0, 140), 'q', g.questionIndex, 'late', Date.now() - (g.questionEndsAt?.__t ?? 0), 'ms after end; wait', Math.round(wait)) }
        }, wait)
      }
    }
    if (m.t === 'doc' && m.id === 'p' && m.data?.lastResult && m.data.lastResult.questionIndex === lastQ && !m._seen) { /* skor çatdı */ }
  }
  // ürək döyüntüsü (hər 30 san)
  const hb = setInterval(async () => { const r = await post('/api/db/commit', { writes: [{ op: 'update', path: `games/${GID}/players/${uid}`, data: { lastSeen: SV } }] }, token); if (!r.ok) M.hbErr++ }, 30000)
  hb.unref?.()
}
const t0 = Date.now()
const all = []
for (let i = 0; i < N; i++) { all.push(player(i).catch((e) => { M.joinErr++; if (M.joinErr < 4) console.log('exc', e.message) })); await sleep(RAMP_MS / N) }
await Promise.all(all)
console.log(`JOINED ${M.players}/${N} in ${((Date.now() - t0) / 1000).toFixed(1)}s · joinErr ${M.joinErr} authErr ${M.authErr} · join p50 ${pct(M.joinMs, 0.5)}ms p95 ${pct(M.joinMs, 0.95)}ms max ${Math.max(...M.joinMs)}ms`)
const report = () => {
  const lines = []
  for (const k of Object.keys(M.phaseLag).filter((x) => !x.endsWith(':ref'))) {
    const ts = M.phaseLag[k], first = Math.min(...ts), ref = M.phaseLag[k + ':ref']
    lines.push(`  ${k.padEnd(14)} çatdı ${String(ts.length).padStart(4)} · ilk→son ${pct(ts.map((t) => t - first), 0.95)}ms(p95) ${Math.max(...ts) - first}ms(max)${ref ? ` · sual başlanğıcına nisbətən son: ${Math.max(...ts) - ref}ms` : ''}`)
  }
  console.log(`--- ${new Date().toISOString().slice(11, 19)} players ${M.players} wsErr ${M.wsErr} disconnects ${M.disconnects} · answers ok ${M.ansMs.length} err ${M.ansErr} ${JSON.stringify(M.ansCodes)} p50 ${pct(M.ansMs, 0.5)}ms p95 ${pct(M.ansMs, 0.95)}ms max ${M.ansMs.length ? Math.max(...M.ansMs) : 0}ms · hbErr ${M.hbErr}`)
  console.log(lines.join('\n'))
}
setInterval(report, 20000)
process.on('SIGTERM', () => { report(); process.exit(0) })
