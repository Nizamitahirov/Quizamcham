import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { motion } from 'framer-motion'
import { db } from '../../firebase/config'
import { ensureAnonymous } from '../../firebase/auth'
import { loadAppSettings } from '../../firebase/db'
import { joinGame, lookupPin } from '../../lib/gameEngine'
import { isValidPin } from '../../lib/pin'
import { cleanName, isNameAllowed } from '../../lib/nameFilter'
import { t } from '../../i18n/az'
import { FullScreen, Page, Spinner } from '../../components/ui'
import { FloatingShapes } from '../../components/FloatingShapes'
import { AvatarPicker, randomAvatar } from '../../components/AvatarPicker'
import { useSession } from '../../store/gameStore'
import { audio } from '../../audio/AudioEngine'
import type { AvatarData, Game } from '../../types'

const PROFILE_KEY = 'qz.profile'

export default function Join() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { gameId: storedGame, setGame } = useSession()
  const [uid, setUid] = useState<string | null>(null)
  const [step, setStep] = useState<'pin' | 'profile'>('pin')
  const [pin, setPin] = useState(params.get('pin') ?? '')
  const [gameId, setGameId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [shakeKey, setShakeKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [avatar, setAvatar] = useState<AvatarData>(() => randomAvatar())
  const [banned, setBanned] = useState<string[]>([])
  const [nameFilterOn, setNameFilterOn] = useState(true)

  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null')
      if (p) { setFirst(p.firstName ?? ''); setLast(p.lastName ?? ''); if (p.avatar) setAvatar(p.avatar) }
    } catch { /* noop */ }
    void ensureAnonymous().then(async (u) => {
      setUid(u.uid)
      void loadAppSettings().then((s) => setBanned(s.bannedWords ?? []))
      // Bərpa: əvvəlki oyun hələ gedirsə, ora qayıt
      if (storedGame && !params.get('pin')) {
        const [g, p] = await Promise.all([getDoc(doc(db, 'games', storedGame)).catch(() => null), getDoc(doc(db, 'games', storedGame, 'players', u.uid)).catch(() => null)])
        if (g?.exists() && p?.exists() && g.get('phase') !== 'finished' && !p.get('kicked')) nav(`/g/${storedGame}`, { replace: true })
      }
      if (params.get('pin') && isValidPin(params.get('pin')!)) void checkPin(params.get('pin')!, u.uid)
    }).catch(() => setError(t.app.error))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fail = (msg: string) => { setError(msg); setShakeKey((k) => k + 1); setBusy(false) }

  async function checkPin(p: string, u = uid) {
    if (!u) return
    if (!isValidPin(p)) return fail(t.join.notFound)
    setBusy(true)
    setError('')
    try {
      const gid = await lookupPin(p)
      if (!gid) return fail(t.join.notFound)
      const gs = await getDoc(doc(db, 'games', gid))
      if (!gs.exists()) return fail(t.join.notFound)
      const g = gs.data() as Game
      const mine = await getDoc(doc(db, 'games', gid, 'players', u)).catch(() => null)
      if (mine?.exists() && !mine.get('kicked') && g.phase !== 'finished') { setGame(gid); nav(`/g/${gid}`); return }
      if (g.phase === 'finished') return fail(t.join.finished)
      if (g.locked) return fail(t.join.locked)
      if (g.phase !== 'lobby' && !g.settings?.lateJoin) return fail(t.join.started)
      if ((g.playerCount ?? 0) >= (g.settings?.maxPlayers ?? 200)) return fail(t.join.full)
      setNameFilterOn(g.settings?.nameFilter !== false)
      setGameId(gid)
      setStep('profile')
      setBusy(false)
    } catch {
      fail(t.app.error)
    }
  }

  async function doJoin() {
    if (!uid || !gameId) return
    const f = first.trim()
    const l = last.trim()
    if (f.length < 2 || l.length < 2) return fail(t.join.nameHint)
    if (nameFilterOn && (!isNameAllowed(f, banned) || !isNameAllowed(l, banned))) return fail(t.join.badName)
    audio.unlock()
    setBusy(true)
    try {
      await joinGame(gameId, uid, f, l, avatar)
      try { localStorage.setItem(PROFILE_KEY, JSON.stringify({ firstName: f, lastName: l, avatar })) } catch { /* noop */ }
      audio.pop()
      setGame(gameId)
      nav(`/g/${gameId}`)
    } catch (e) {
      const code = (e as { code?: string }).code
      fail(code === 'permission-denied' ? t.join.locked : t.app.error)
    }
  }

  return (
    <FullScreen>
      <FloatingShapes count={10} />
      <Page>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 p-4 pb-10">
          <div className="text-center">
            <div className="text-6xl">🎯</div>
            <h1 className="mt-1 text-4xl">{t.app.name}</h1>
          </div>
          {!uid ? <Spinner /> : step === 'pin' ? (
            <motion.form key={shakeKey} className={`card flex flex-col gap-4 p-5 ${shakeKey ? 'shake' : ''}`} onSubmit={(e) => { e.preventDefault(); void checkPin(pin) }}>
              <label className="label" htmlFor="pin">{t.join.pin}</label>
              <input
                id="pin" className="input font-display text-center text-4xl tracking-[.3em]" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code"
                maxLength={6} placeholder={t.join.pinPlaceholder} value={pin} autoFocus
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              {error && <p className="text-center font-extrabold text-red-600" role="alert">{error}</p>}
              <button className="btn btn-primary text-xl" disabled={busy || pin.length !== 6}>{busy ? t.app.loading : t.join.continue}</button>
            </motion.form>
          ) : (
            <motion.form initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void doJoin() }}>
              <h2 className="text-center text-2xl">{t.join.profileTitle}</h2>
              <div className="card grid grid-cols-2 gap-3 p-4">
                <div>
                  <label className="label" htmlFor="fn">{t.join.firstName}</label>
                  <input id="fn" className="input" value={first} maxLength={20} autoComplete="given-name" onChange={(e) => setFirst(cleanName(e.target.value))} />
                </div>
                <div>
                  <label className="label" htmlFor="ln">{t.join.lastName}</label>
                  <input id="ln" className="input" value={last} maxLength={20} autoComplete="family-name" onChange={(e) => setLast(cleanName(e.target.value))} />
                </div>
                <p className="col-span-2 -mt-1 text-xs text-slate-500">{t.join.nameHint}</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur">
                <AvatarPicker value={avatar} onChange={(a) => { setAvatar(a); audio.unlock(); audio.click() }} />
              </div>
              {error && <p key={shakeKey} className="shake rounded-xl bg-white py-2 text-center font-extrabold text-red-600" role="alert">{error}</p>}
              <button className="btn btn-primary sticky bottom-3 text-2xl" disabled={busy || first.trim().length < 2 || last.trim().length < 2}>{busy ? t.join.joining : t.join.go}</button>
            </motion.form>
          )}
        </div>
      </Page>
    </FullScreen>
  )
}
