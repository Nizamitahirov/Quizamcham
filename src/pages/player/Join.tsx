import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Rocket } from 'lucide-react'
import { doc, getDoc } from 'firebase/firestore'
import { motion } from 'framer-motion'
import { db } from '../../firebase/config'
import { ensureAnonymous } from '../../firebase/auth'
import { loadAppSettings } from '../../firebase/db'
import { joinGame, lookupPin } from '../../lib/gameEngine'
import { isValidPin } from '../../lib/pin'
import { cleanName, isNameAllowed } from '../../lib/nameFilter'
import { t } from '../../i18n/az'
import { Spinner } from '../../components/ui'
import { FuturisticBg } from '../../components/FuturisticBg'
import { Logo } from '../../components/Brand'
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

  const steps = [t.join.step1, t.join.step2, t.join.step3]
  const cur = step === 'pin' ? 0 : 1
  return (
    <div className="noise relative flex min-h-dvh flex-col overflow-hidden bg-night">
      <FuturisticBg floor={false} intensity={0.8} />
      <header className="relative z-10 mx-auto flex w-full max-w-md items-center justify-between px-4 pt-5">
        <Link to="/" aria-label={t.app.home}><Logo size={34} /></Link>
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-8 pt-6">
        <ol className="flex items-center gap-2" aria-label="progress">
          {steps.map((label, i) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${i <= cur ? 'text-white' : 'bg-white/10 text-white/50'}`} style={i <= cur ? { background: 'var(--grad)' } : undefined}>{i + 1}</span>
              <span className={`text-xs font-bold ${i <= cur ? 'text-white' : 'text-white/45'}`}>{label}</span>
              {i < steps.length - 1 && <span className={`h-0.5 flex-1 rounded-full ${i < cur ? 'bg-orange-500' : 'bg-white/10'}`} />}
            </li>
          ))}
        </ol>
        {!uid ? <Spinner /> : step === 'pin' ? (
          <motion.form key={shakeKey} className={`glass-strong gradient-border flex flex-col gap-5 p-6 ${shakeKey ? 'shake' : ''}`} onSubmit={(e) => { e.preventDefault(); void checkPin(pin) }}>
            <div>
              <h1 className="text-3xl font-black">{t.join.title}</h1>
              <p className="mt-1 text-sm text-white/60">{t.home.subtitle}</p>
            </div>
            <label className="label-dark mb-0" htmlFor="pin">{t.join.pin}</label>
            <input
              id="pin" className="input-dark font-display h-20 text-center text-5xl font-black tracking-[.35em]" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code"
              maxLength={6} placeholder="••••••" value={pin} autoFocus
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            {error && <p className="rounded-xl bg-red-500/15 px-3 py-2 text-center text-sm font-bold text-red-300" role="alert">{error}</p>}
            <button className="btn btn-primary btn-lg" disabled={busy || pin.length !== 6}>{busy ? t.app.loading : <>{t.join.continue}<ArrowRight /></>}</button>
          </motion.form>
        ) : (
          <motion.form initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void doJoin() }}>
            <div>
              <p className="text-sm font-bold text-orange-300">{t.join.hello}</p>
              <h1 className="text-3xl font-black">{t.join.profileTitle}</h1>
            </div>
            <div className="glass grid grid-cols-2 gap-3 p-4">
              <div>
                <label className="label-dark" htmlFor="fn">{t.join.firstName}</label>
                <input id="fn" className="input-dark" value={first} maxLength={20} autoComplete="given-name" onChange={(e) => setFirst(cleanName(e.target.value))} />
              </div>
              <div>
                <label className="label-dark" htmlFor="ln">{t.join.lastName}</label>
                <input id="ln" className="input-dark" value={last} maxLength={20} autoComplete="family-name" onChange={(e) => setLast(cleanName(e.target.value))} />
              </div>
              <p className="col-span-2 -mt-1 text-xs text-white/45">{t.join.nameHint}</p>
            </div>
            <div className="glass p-4">
              <span className="label-dark">{t.join.chooseAvatar}</span>
              <AvatarPicker value={avatar} onChange={(a) => { setAvatar(a); audio.unlock(); audio.click() }} />
            </div>
            {error && <p key={shakeKey} className="shake rounded-xl bg-red-500/15 py-2 text-center text-sm font-bold text-red-300" role="alert">{error}</p>}
            <p className="text-center text-xs leading-relaxed text-white/50">{t.privacy.short} <Link to="/privacy" className="underline">{t.privacy.more}</Link></p>
            <button className="btn btn-primary btn-lg sticky bottom-4 text-xl" disabled={busy || first.trim().length < 2 || last.trim().length < 2}>
              {busy ? t.join.joining : <><Rocket />{t.join.go}</>}
            </button>
          </motion.form>
        )}
      </main>
    </div>
  )
}
