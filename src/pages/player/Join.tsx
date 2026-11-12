import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Rocket } from 'lucide-react'
import { doc, getDoc, getDocFromServer } from 'firebase/firestore'
import { motion } from 'framer-motion'
import { db } from '../../firebase/config'
import { ensureAnonymous } from '../../firebase/auth'
import { loadAppSettings } from '../../firebase/db'
import { joinBlockReason, joinGame, lookupPin } from '../../lib/gameEngine'
import { isValidPin } from '../../lib/pin'
import { cleanName, isNameAllowed } from '../../lib/nameFilter'
import { t } from '../../i18n/az'
import { Spinner } from '../../components/ui'
import { LegalLink, LegalModal } from '../../components/LegalModal'
import { FuturisticBg } from '../../components/FuturisticBg'
import { Logo } from '../../components/Brand'
import { LangSwitch } from '../../components/LangSwitch'
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
  const [legal, setLegal] = useState(false)
  const [slow, setSlow] = useState(false)
  // Qoşulma 6 saniyədən uzun çəkirsə, iştirakçıya bunun normal olduğunu bildir (təkrar basıb pozmasın)
  useEffect(() => {
    if (!busy) { setSlow(false); return }
    const id = setTimeout(() => setSlow(true), 6000)
    return () => clearTimeout(id)
  }, [busy])
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
        if (g?.exists() && p?.exists() && !p.get('kicked')) nav(`/g/${storedGame}`, { replace: true })
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
      const found = await lookupPin(p)
      if (!found) return fail(t.join.notFound)
      const gid = found.gameId
      // Öz iştirakçı sənədi və oyun paralel oxunur (bir gediş az)
      let [mineRes, gameRes] = await Promise.allSettled([getDoc(doc(db, 'games', gid, 'players', u)), getDoc(doc(db, 'games', gid))])
      // öz sənədini oxumaq rədd olunursa, giriş tokeni hələ çatmayıb — qısa fasilədən sonra təkrar
      if (mineRes.status === 'rejected') {
        await new Promise((r) => setTimeout(r, 800));
        [mineRes, gameRes] = await Promise.allSettled([getDoc(doc(db, 'games', gid, 'players', u)), getDoc(doc(db, 'games', gid))])
      }
      const mine = mineRes.status === 'fulfilled' ? mineRes.value : null
      // bu oyunun iştirakçısıdırsa, oyun bitmiş olsa belə nəticəyə keçir
      if (mine?.exists()) {
        if (mine.get('kicked')) return fail(t.join.kicked)
        setGame(gid); nav(`/g/${gid}`); return
      }
      if (!found.active) return fail(t.join.finished)
      if (gameRes.status === 'rejected') {
        // bitmiş oyun kənar şəxslərə bağlıdır
        return fail((gameRes.reason as { code?: string }).code === 'permission-denied' ? t.join.finished : t.join.retry)
      }
      const gs = gameRes.value
      if (!gs.exists()) return fail(t.join.notFound)
      const g = gs.data() as Game
      const why = joinBlockReason(g)
      if (why === 'full' && g.plan === 'free') void import('../../firebase/extras').then((m) => m.track('plan_limit_hit'))
      if (why) return fail(why === 'full' && g.plan === 'free' ? t.join.fullFree : t.join[why])
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
    // yadda qalmış 3D avatar yalnız həmin hesabın sahibinə aiddir (anonim girişdə və ya başqa hesabda adi avatar)
    const av: AvatarData = avatar.style === '3d' && avatar.seed !== uid ? { ...randomAvatar(), accessory: avatar.accessory } : avatar
    try {
      // Qoşulma ilk dəfə "icazə yoxdur" ilə qayıdarsa (giriş tokeni hələ çatmayıb / keçici), bir dəfə yenidən cəhd
      await joinGame(gameId, uid, f, l, av).catch(async (e) => {
        if ((e as { code?: string }).code !== 'permission-denied') throw e
        await new Promise((r) => setTimeout(r, 1200))
        await joinGame(gameId, uid, f, l, av)
      })
      try { localStorage.setItem(PROFILE_KEY, JSON.stringify({ firstName: f, lastName: l, avatar: av })) } catch { /* noop */ }
      audio.pop()
      setGame(gameId)
      nav(`/g/${gameId}`)
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === 'kicked') return fail(t.join.kicked)
      if (code !== 'permission-denied') return fail(t.join.retry)
      // Səbəbi oyunun hazırkı vəziyyətindən dəqiq müəyyən et (hər rədd "Lobbi bağlıdır" deyil)
      const gs = await getDocFromServer(doc(db, 'games', gameId)).catch(() => null)
      const why = gs?.exists() ? joinBlockReason(gs.data() as Game) : 'finished'
      fail(why ? t.join[why] : nameFilterOn ? t.join.badName : t.join.retry)
    }
  }

  const steps = [t.join.step1, t.join.step2, t.join.step3]
  const cur = step === 'pin' ? 0 : 1
  return (
    <div className="noise relative flex min-h-dvh flex-col overflow-hidden bg-night">
      <FuturisticBg floor={false} intensity={0.8} />
      <header className="relative z-30 mx-auto flex w-full max-w-md items-center justify-between px-4 pt-5">
        <Link to="/" aria-label={t.app.home}><Logo size={34} /></Link>
        <LangSwitch />
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
            {params.get('none') && <p className="rounded-xl bg-amber-400/15 px-3 py-2 text-sm font-semibold text-amber-200" role="status">{t.join.noActive}</p>}
            <label className="label-dark mb-0" htmlFor="pin">{t.join.pin}</label>
            <input
              id="pin" className="input-dark font-display h-20 px-2 pl-[calc(.5rem+.22em)] text-center text-4xl font-black tracking-[.22em] sm:text-5xl" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code"
              maxLength={6} placeholder="••••••" value={pin} autoFocus
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            {error && <p className="rounded-xl bg-red-500/15 px-3 py-2 text-center text-sm font-bold text-red-300" role="alert">{error}</p>}
            {slow && <p className="rounded-xl bg-amber-400/15 px-3 py-2 text-center text-sm font-semibold text-amber-200" role="status">{t.join.slow}</p>}
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
            {slow && <p className="rounded-xl bg-amber-400/15 px-3 py-2 text-center text-sm font-semibold text-amber-200" role="status">{t.join.slow}</p>}
            <p className="text-center text-xs leading-relaxed text-white/50">{t.privacy.short} <LegalLink onOpen={() => setLegal(true)} /></p>
            <LegalModal ids={['privacy']} open={legal} onClose={() => setLegal(false)} />
            <button className="btn btn-primary btn-lg sticky bottom-4 text-xl" disabled={busy || first.trim().length < 2 || last.trim().length < 2}>
              {busy ? t.join.joining : <><Rocket />{t.join.go}</>}
            </button>
          </motion.form>
        )}
      </main>
    </div>
  )
}
