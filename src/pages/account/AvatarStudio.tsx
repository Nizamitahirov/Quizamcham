import { Suspense, useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { Navigate } from 'react-router-dom'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Check, Dices, Footprints, Glasses, Loader2, Palette, RotateCcw, Save, Shirt, Smile, Sparkles, UserRound, Crown, Scissors, Move3d } from 'lucide-react'
import { t } from '../../i18n/az'
import { useAccount } from '../../lib/account'
import { BACKGROUNDS, DEFAULT_AVATAR, EYE_COLORS, HAIR_COLORS, label, loadAvatar, OPTIONS, PALETTE, randomAvatar, saveAvatar, SKIN, type AvatarConfig, type Key, type Opt } from '../../lib/avatar3d'
import { Character } from '../../components/avatar3d/Character'
import { Spinner } from '../../components/ui'
import { toast } from '../../components/dialogs'
import { StudentShell } from '../../components/StudentShell'
import { Switch } from '../../components/kit'

const V = t.av
type Cat = keyof typeof V.cats
const CAT_ICON: Record<Cat, typeof Smile> = { body: UserRound, face: Smile, hair: Scissors, hat: Crown, outfit: Shirt, extras: Glasses, scene: Palette }

interface CaptureApi { capture: (bg: readonly [string, string]) => string }
/** Portret kadrı: kameranı müvəqqəti üzə yönəldir, render edir, kvadrat webp qaytarır. */
const Capturer = forwardRef<CaptureApi>(function Capturer(_, ref) {
  const { gl, scene, camera, size } = useThree()
  useImperativeHandle(ref, () => ({
    capture(bg) {
      const cam = camera as THREE.PerspectiveCamera
      const saved = { pos: cam.position.clone(), quat: cam.quaternion.clone(), aspect: cam.aspect }
      cam.position.set(0, 1.78, 2.55); cam.lookAt(0, 1.72, 0); cam.updateProjectionMatrix()
      gl.render(scene, cam)
      const src = gl.domElement, S = 320, out = document.createElement('canvas'); out.width = out.height = S
      const g = out.getContext('2d')!
      const gr = g.createLinearGradient(0, 0, S, S); gr.addColorStop(0, bg[0]); gr.addColorStop(1, bg[1]); g.fillStyle = gr; g.fillRect(0, 0, S, S)
      const side = Math.min(src.width, src.height), sx = (src.width - side) / 2, sy = (src.height - side) / 2
      g.drawImage(src, sx, sy, side, side, 0, 0, S, S)
      cam.position.copy(saved.pos); cam.quaternion.copy(saved.quat); cam.aspect = saved.aspect; cam.updateProjectionMatrix()
      void size
      let url = out.toDataURL('image/webp', 0.82)
      if (!url.startsWith('data:image/webp')) url = out.toDataURL('image/jpeg', 0.85)
      return url
    },
  }), [gl, scene, camera, size])
  return null
})

function Stage({ cfg, capRef }: { cfg: AvatarConfig; capRef: React.RefObject<CaptureApi | null> }) {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 1.4, 6.6], fov: 30 }} gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true }} aria-label={V.title}>
      <hemisphereLight args={['#FFFFFF', '#3B3F66', 0.9]} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-4, 3, -3]} intensity={0.7} color="#FF9A5C" />
      <pointLight position={[0, 2.4, 2.5]} intensity={0.6} />
      <Suspense fallback={null}><Character cfg={cfg} /></Suspense>
      <ContactShadows position={[0, 0, 0]} opacity={0.45} scale={4} blur={2.4} far={2} />
      <OrbitControls target={[0, 1.25, 0]} enablePan={false} minDistance={3.4} maxDistance={8} minPolarAngle={0.9} maxPolarAngle={1.75} enableDamping />
      <Capturer ref={capRef} />
    </Canvas>
  )
}

function Tiles({ k, value, onPick }: { k: Key; value: string; onPick: (v: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup">
      {(OPTIONS[k] as readonly Opt[]).map((x) => {
        const on = x.id === value
        return (
          <button key={x.id} type="button" role="radio" aria-checked={on} onClick={() => onPick(x.id)}
            className={`relative flex flex-col items-center gap-1 rounded-xl border px-1.5 py-2.5 text-center transition ${on ? 'border-orange-400/60 bg-orange-500/10 shadow-[0_0_0_3px_rgba(255,90,31,.12)]' : 'border-line bg-white/[.02] hover:border-line-strong hover:bg-white/[.05]'}`}>
            <span className="text-2xl leading-none" aria-hidden>{x.e}</span>
            <span className="line-clamp-2 text-[11px] font-medium leading-tight text-fg2">{label(x)}</span>
            {on && <Check className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-orange-300" />}
          </button>
        )
      })}
    </div>
  )
}

function Swatches({ colors, value, onPick, name }: { colors: readonly string[]; value: string; onPick: (v: string) => void; name: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={name}>
      {colors.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value.toLowerCase() === c.toLowerCase()} aria-label={c} onClick={() => onPick(c)}
          className={`h-8 w-8 rounded-full border transition hover:scale-110 ${value.toLowerCase() === c.toLowerCase() ? 'border-[#fff] ring-2 ring-orange-400 ring-offset-2 ring-offset-[#171A33]' : 'border-white/15'}`} style={{ background: c }} />
      ))}
      <label className="relative flex h-8 items-center gap-1.5 rounded-full border border-dashed border-line-strong px-2.5 text-xs text-muted hover:text-fg" title={V.custom}>
        <Palette className="h-3.5 w-3.5" />{V.custom}
        <input type="color" value={value} onChange={(e) => onPick(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={`${name}: ${V.custom}`} />
      </label>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="flex flex-col gap-2.5"><h3 className="label mb-0">{title}</h3>{children}</section>
}

/** Avatar studiyası: 3D personajı qurmaq, saxlamaq. */
export default function AvatarStudio() {
  const { loading, user } = useAccount()
  const [cfg, setCfg] = useState<AvatarConfig>(DEFAULT_AVATAR)
  const [saved, setSaved] = useState<string>(JSON.stringify(DEFAULT_AVATAR))
  const [ready, setReady] = useState(false)
  const [cat, setCat] = useState<Cat>('body')
  const [busy, setBusy] = useState(false)
  const capRef = useRef<CaptureApi | null>(null)
  useEffect(() => {
    if (!user) return
    void loadAvatar(user.uid).then((a) => { if (a) { setCfg(a.config); setSaved(JSON.stringify(a.config)) } }).finally(() => setReady(true))
  }, [user])
  const dirty = ready && JSON.stringify(cfg) !== saved
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])
  const set = useCallback(<K extends keyof AvatarConfig>(k: K, v: AvatarConfig[K]) => setCfg((c) => ({ ...c, [k]: v })), [])
  const bg = BACKGROUNDS[cfg.bg]
  const save = async () => {
    if (!user || !capRef.current) return
    setBusy(true)
    try {
      const thumb = capRef.current.capture(bg)
      await saveAvatar(user.uid, cfg, thumb)
      setSaved(JSON.stringify(cfg)); toast(V.saved)
    } catch { toast(t.app.error, 'error') } finally { setBusy(false) }
  }
  const panels: Record<Cat, React.ReactNode> = useMemo(() => ({
    body: <>
      <Group title={V.f.skin}><Swatches name={V.f.skin} colors={SKIN} value={cfg.skin} onPick={(v) => set('skin', v)} /></Group>
      <Group title={V.f.build}><Tiles k="build" value={cfg.build} onPick={(v) => set('build', v as AvatarConfig['build'])} /></Group>
      <Group title={V.f.pose}><Tiles k="pose" value={cfg.pose} onPick={(v) => set('pose', v as AvatarConfig['pose'])} /></Group>
    </>,
    face: <>
      <Group title={V.f.eyes}><Tiles k="eyes" value={cfg.eyes} onPick={(v) => set('eyes', v as AvatarConfig['eyes'])} /></Group>
      <Group title={V.f.eyeColor}><Swatches name={V.f.eyeColor} colors={EYE_COLORS} value={cfg.eyeColor} onPick={(v) => set('eyeColor', v)} /></Group>
      <Group title={V.f.brows}><Tiles k="brows" value={cfg.brows} onPick={(v) => set('brows', v as AvatarConfig['brows'])} /></Group>
      <Group title={V.f.mouth}><Tiles k="mouth" value={cfg.mouth} onPick={(v) => set('mouth', v as AvatarConfig['mouth'])} /></Group>
      <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
        <div className="flex items-center justify-between text-sm font-medium"><span>{V.f.blush}</span><Switch checked={cfg.blush} onChange={(v) => set('blush', v)} label={V.f.blush} /></div>
        <div className="flex items-center justify-between text-sm font-medium"><span>{V.f.freckles}</span><Switch checked={cfg.freckles} onChange={(v) => set('freckles', v)} label={V.f.freckles} /></div>
      </div>
      <Group title={V.f.glasses}><Tiles k="glasses" value={cfg.glasses} onPick={(v) => set('glasses', v as AvatarConfig['glasses'])} /></Group>
      {cfg.glasses !== 'none' && <Group title={V.f.glassesColor}><Swatches name={V.f.glassesColor} colors={PALETTE} value={cfg.glassesColor} onPick={(v) => set('glassesColor', v)} /></Group>}
    </>,
    hair: <>
      <Group title={V.f.hair}><Tiles k="hair" value={cfg.hair} onPick={(v) => set('hair', v as AvatarConfig['hair'])} /></Group>
      <Group title={V.f.hairColor}><Swatches name={V.f.hairColor} colors={HAIR_COLORS} value={cfg.hairColor} onPick={(v) => set('hairColor', v)} /></Group>
      <Group title={V.f.facial}><Tiles k="facial" value={cfg.facial} onPick={(v) => set('facial', v as AvatarConfig['facial'])} /></Group>
    </>,
    hat: <>
      <Group title={V.f.hat}><Tiles k="hat" value={cfg.hat} onPick={(v) => set('hat', v as AvatarConfig['hat'])} /></Group>
      {!['none', 'halo', 'crown', 'flowers'].includes(cfg.hat) && <Group title={V.f.hatColor}><Swatches name={V.f.hatColor} colors={PALETTE} value={cfg.hatColor} onPick={(v) => set('hatColor', v)} /></Group>}
    </>,
    outfit: <>
      <Group title={V.f.top}><Tiles k="top" value={cfg.top} onPick={(v) => set('top', v as AvatarConfig['top'])} /></Group>
      <Group title={V.f.topColor}><Swatches name={V.f.topColor} colors={PALETTE} value={cfg.topColor} onPick={(v) => set('topColor', v)} /></Group>
      <Group title={V.f.topColor2}><Swatches name={V.f.topColor2} colors={PALETTE} value={cfg.topColor2} onPick={(v) => set('topColor2', v)} /></Group>
      <Group title={V.f.pattern}><Tiles k="pattern" value={cfg.pattern} onPick={(v) => set('pattern', v as AvatarConfig['pattern'])} /></Group>
      {(cfg.pattern === 'number' || cfg.top === 'jersey') && <Group title={V.f.number}>
        <input type="number" min={0} max={99} className="input w-28" value={cfg.number} onChange={(e) => set('number', Math.max(0, Math.min(99, Math.round(Number(e.target.value) || 0))))} aria-label={V.f.number} />
      </Group>}
      {cfg.top !== 'dress' && <Group title={V.f.bottom}><Tiles k="bottom" value={cfg.bottom} onPick={(v) => set('bottom', v as AvatarConfig['bottom'])} /></Group>}
      <Group title={V.f.bottomColor}><Swatches name={V.f.bottomColor} colors={PALETTE} value={cfg.bottomColor} onPick={(v) => set('bottomColor', v)} /></Group>
      <Group title={V.f.shoes}><Tiles k="shoes" value={cfg.shoes} onPick={(v) => set('shoes', v as AvatarConfig['shoes'])} /></Group>
      <Group title={V.f.shoeColor}><Swatches name={V.f.shoeColor} colors={PALETTE} value={cfg.shoeColor} onPick={(v) => set('shoeColor', v)} /></Group>
    </>,
    extras: <>
      <Group title={V.f.back}><Tiles k="back" value={cfg.back} onPick={(v) => set('back', v as AvatarConfig['back'])} /></Group>
      {cfg.back !== 'none' && <Group title={V.f.backColor}><Swatches name={V.f.backColor} colors={PALETTE} value={cfg.backColor} onPick={(v) => set('backColor', v)} /></Group>}
      <Group title={V.f.neck}><Tiles k="neck" value={cfg.neck} onPick={(v) => set('neck', v as AvatarConfig['neck'])} /></Group>
      {cfg.neck !== 'none' && <Group title={V.f.neckColor}><Swatches name={V.f.neckColor} colors={PALETTE} value={cfg.neckColor} onPick={(v) => set('neckColor', v)} /></Group>}
      <Group title={V.f.hand}><Tiles k="hand" value={cfg.hand} onPick={(v) => set('hand', v as AvatarConfig['hand'])} /></Group>
    </>,
    scene: <>
      <Group title={V.f.bg}>
        <div className="grid grid-cols-4 gap-2">
          {BACKGROUNDS.map((b, i) => (
            <button key={i} type="button" aria-label={`${V.f.bg} ${i + 1}`} aria-pressed={cfg.bg === i} onClick={() => set('bg', i)}
              className={`aspect-square rounded-xl border transition hover:scale-105 ${cfg.bg === i ? 'border-[#fff] ring-2 ring-orange-400 ring-offset-2 ring-offset-[#171A33]' : 'border-white/10'}`} style={{ background: `linear-gradient(135deg, ${b[0]}, ${b[1]})` }} />
          ))}
        </div>
      </Group>
      <Group title={V.f.pose}><Tiles k="pose" value={cfg.pose} onPick={(v) => set('pose', v as AvatarConfig['pose'])} /></Group>
    </>,
  }), [cfg, set])

  if (loading) return <div className="bg-app flex min-h-dvh items-center justify-center"><Spinner /></div>
  if (!user || user.isAnonymous) return <Navigate to={`/start?next=/avatar`} replace />
  return (
    <StudentShell back="-1" title={V.title} width="max-w-7xl" actions={
      <button className="btn btn-primary btn-sm" disabled={busy || !dirty} onClick={() => void save()}>{busy ? <Loader2 className="animate-spin" /> : <Save />}<span className="hidden sm:inline">{busy ? V.saving : V.save}</span></button>
    }>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_440px]">
        <section className="relative overflow-hidden rounded-[var(--radius)] border border-line lg:sticky lg:top-20 lg:h-[calc(100dvh-7rem)]" style={{ background: `radial-gradient(120% 90% at 50% 0%, ${bg[0]}, ${bg[1]} 55%, #0B0C19 120%)` }}>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent" />
          <div className="h-[56dvh] min-h-80 lg:h-full">{ready ? <Stage cfg={cfg} capRef={capRef} /> : <div className="flex h-full items-center justify-center"><Spinner /></div>}</div>
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            <button className="btn btn-sm border-white/15 bg-black/35 text-[#fff] backdrop-blur hover:bg-black/50" onClick={() => setCfg(randomAvatar())}><Dices />{V.random}</button>
            <button className="btn btn-sm border-white/15 bg-black/35 text-[#fff] backdrop-blur hover:bg-black/50" onClick={() => setCfg(DEFAULT_AVATAR)}><RotateCcw />{V.reset}</button>
          </div>
          <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1.5 text-xs font-medium text-white/85 backdrop-blur"><Move3d className="h-3.5 w-3.5" />{V.rotate}</span>
            <div className="flex gap-1 rounded-full bg-black/35 p-1 backdrop-blur" role="radiogroup" aria-label={V.f.pose}>
              {(OPTIONS.pose as readonly Opt[]).map((p) => (
                <button key={p.id} type="button" role="radio" aria-checked={cfg.pose === p.id} title={label(p)} onClick={() => set('pose', p.id as AvatarConfig['pose'])}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-base transition ${cfg.pose === p.id ? 'bg-white/25' : 'hover:bg-white/10'}`}>{p.e}</button>
              ))}
            </div>
          </div>
          {dirty && <span className="absolute right-3 top-3 hidden rounded-full bg-amber-400/90 px-3 py-1 text-xs font-semibold text-black sm:inline">{V.unsaved}</span>}
        </section>

        <section className="card flex min-h-0 flex-col overflow-hidden lg:h-[calc(100dvh-7rem)]">
          <div className="border-b border-line p-3">
            <h1 className="flex items-center gap-2 px-1 font-sans text-lg font-semibold"><Sparkles className="h-4 w-4 text-orange-300" />{V.title}</h1>
            <p className="mb-3 px-1 text-xs text-muted">{V.sub}</p>
            <div className="grid grid-cols-7 gap-1" role="tablist">
              {(Object.keys(V.cats) as Cat[]).map((k) => {
                const Icon = CAT_ICON[k], on = cat === k
                return (
                  <button key={k} type="button" role="tab" aria-selected={on} onClick={() => setCat(k)} title={V.cats[k]}
                    className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10.5px] font-semibold transition ${on ? 'bg-white/[.08] text-fg' : 'text-muted hover:bg-white/[.04] hover:text-fg'}`}>
                    <Icon className={`h-[18px] w-[18px] ${on ? 'text-orange-300' : ''}`} /><span className="truncate">{V.cats[k]}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4 scrollbar-thin" role="tabpanel">{panels[cat]}</div>
          <div className="flex items-center gap-2 border-t border-line p-3">
            {dirty ? <span className="mr-auto text-xs text-amber-300">{V.unsaved}</span> : <span className="mr-auto flex items-center gap-1.5 text-xs text-muted"><Footprints className="h-3.5 w-3.5" />{V.rotate}</span>}
            <button className="btn btn-primary" disabled={busy || !dirty} onClick={() => void save()}>{busy ? <Loader2 className="animate-spin" /> : <Save />}{busy ? V.saving : V.save}</button>
          </div>
        </section>
      </div>
    </StudentShell>
  )
}
