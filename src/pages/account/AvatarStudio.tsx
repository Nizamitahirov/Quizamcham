import { Suspense, useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { Navigate } from 'react-router-dom'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, SMAA } from '@react-three/postprocessing'
import * as THREE from 'three'
import { Check, Dices, Download, Glasses, Loader2, Palette, Redo2, RotateCcw, RotateCw, Save, Shirt, Smile, Sparkles, Undo2, UserRound, Crown, Scissors, Move3d, Wand2 } from 'lucide-react'
import { t } from '../../i18n/az'
import { useAccount } from '../../lib/account'
import { BACKGROUNDS, DEFAULT_AVATAR, EYE_COLORS, HAIR_COLORS, label, loadAvatar, OPTIONS, PALETTE, randomAvatar, saveAvatar, SKIN, type AvatarConfig, type Key, type Opt } from '../../lib/avatar3d'
import { Character, HEAD_Y } from '../../components/avatar3d/Character'
import { Spinner } from '../../components/ui'
import { toast } from '../../components/dialogs'
import { StudentShell } from '../../components/StudentShell'
import { Switch } from '../../components/kit'

const V = t.av
type Cat = keyof typeof V.cats
const CATS: Cat[] = ['presets', 'body', 'face', 'hair', 'hat', 'outfit', 'extras', 'scene']
const CAT_ICON: Record<Cat, typeof Smile> = { presets: Wand2, body: UserRound, face: Smile, hair: Scissors, hat: Crown, outfit: Shirt, extras: Glasses, scene: Palette }

/** Kamera baxışları: bölməyə görə kadr özü yaxınlaşır (üz/saç/papaq — baş, geyim — bədən). */
type View = 'full' | 'head' | 'body'
const VIEWS: Record<View, { pos: [number, number, number]; target: [number, number, number] }> = {
  full: { pos: [0, 1.25, 6.3], target: [0, 1.0, 0] },
  head: { pos: [0.5, HEAD_Y + 0.12, 3.5], target: [0, HEAD_Y + 0.02, 0] },
  body: { pos: [0, 0.95, 4.7], target: [0, 0.72, 0] },
}
const CAT_VIEW: Record<Cat, View> = { presets: 'full', body: 'full', face: 'head', hair: 'head', hat: 'head', outfit: 'body', extras: 'full', scene: 'full' }

/** Hazır obrazlar — bir kliklə başlanğıc; sonra istənilən detal dəyişdirilə bilər. */
const PRESETS: { id: keyof typeof V.presets; e: string; c: Partial<AvatarConfig> }[] = [
  { id: 'student', e: '🎒', c: { hair: 'short', top: 'hoodie', topColor: '#F0262F', pattern: 'logo', bottom: 'joggers', bottomColor: '#111827', shoes: 'sneakers', shoeColor: '#F5F5F7', back: 'backpack', backColor: '#3B82F6', pose: 'wave', bg: 0 } },
  { id: 'teacher', e: '📘', c: { hair: 'sidepart', glasses: 'round', glassesColor: '#111827', top: 'shirt', topColor: '#F5F5F7', topColor2: '#3B82F6', pattern: 'solid', bottom: 'pants', bottomColor: '#374151', shoes: 'loafers', shoeColor: '#7C4A2D', hand: 'book', eyes: 'round', mouth: 'smile', pose: 'idle', bg: 2 } },
  { id: 'champion', e: '🏆', c: { hair: 'spiky', hairColor: '#1C1714', top: 'jersey', topColor: '#3B82F6', topColor2: '#F5F5F7', number: 10, pattern: 'number', bottom: 'shorts', bottomColor: '#F5F5F7', shoes: 'hightops', shoeColor: '#F0262F', neck: 'medal', neckColor: '#F0262F', hand: 'trophy', eyes: 'happy', mouth: 'grin', pose: 'cheer', bg: 4 } },
  { id: 'wizard', e: '🧙', c: { hair: 'long', hairColor: '#A8A8B0', facial: 'beard', hat: 'wizard', hatColor: '#6366F1', top: 'sweater', topColor: '#6366F1', topColor2: '#FFC531', pattern: 'solid', bottom: 'pants', bottomColor: '#1E3A5F', shoes: 'boots', shoeColor: '#7C4A2D', back: 'cape', backColor: '#A855F7', brows: 'thick', eyes: 'round', pose: 'idle', bg: 6 } },
  { id: 'musician', e: '🎸', c: { hair: 'wavy', hairColor: '#8B6CF6', hat: 'headphones', hatColor: '#F0262F', glasses: 'sun', glassesColor: '#111827', top: 'jacket', topColor: '#111827', topColor2: '#F5F5F7', pattern: 'solid', bottom: 'jeans', bottomColor: '#3B82F6', shoes: 'hightops', shoeColor: '#F5F5F7', back: 'guitar', backColor: '#F0262F', hand: 'mic', mouth: 'open', pose: 'dance', bg: 1 } },
  { id: 'astronaut', e: '🚀', c: { hair: 'buzz', glasses: 'visor', glassesColor: '#3B82F6', top: 'jacket', topColor: '#F5F5F7', topColor2: '#FF7A1A', pattern: 'logo', bottom: 'cargo', bottomColor: '#F5F5F7', shoes: 'boots', shoeColor: '#9CA3AF', back: 'jetpack', backColor: '#9CA3AF', pose: 'cheer', mouth: 'grin', bg: 5 } },
  { id: 'royal', e: '👑', c: { hair: 'bun', hairColor: '#E6C27A', hat: 'crown', eyes: 'lashes', eyeColor: '#3B82F6', mouth: 'smile', blush: true, top: 'dress', topColor: '#EC4899', topColor2: '#FFC531', pattern: 'solid', shoes: 'loafers', shoeColor: '#FFC531', neck: 'chain', neckColor: '#FFC531', back: 'wings', pose: 'wave', bg: 7 } },
  { id: 'cat', e: '🐱', c: { hair: 'bob', hairColor: '#F07AA8', hat: 'cat', hatColor: '#F07AA8', eyes: 'sparkle', eyeColor: '#14B8A6', mouth: 'cat', blush: true, top: 'sweater', topColor: '#FDE68A', topColor2: '#F07AA8', pattern: 'stripes', bottom: 'skirt', bottomColor: '#A855F7', shoes: 'sneakers', shoeColor: '#F5F5F7', hand: 'icecream', pose: 'idle', bg: 3 } },
]

interface CaptureApi { capture: (bg: readonly [string, string], size?: number) => string }
/** Portret kadrı: kameranı müvəqqəti üzə yönəldir, render edir, kvadrat webp qaytarır. */
const Capturer = forwardRef<CaptureApi>(function Capturer(_, ref) {
  const { gl, scene, camera, size } = useThree()
  useImperativeHandle(ref, () => ({
    capture(bg, S = 320) {
      const cam = camera as THREE.PerspectiveCamera
      const saved = { pos: cam.position.clone(), quat: cam.quaternion.clone(), aspect: cam.aspect }
      cam.position.set(0, HEAD_Y + 0.1, 3.9); cam.lookAt(0, HEAD_Y + 0.04, 0); cam.updateProjectionMatrix()
      gl.render(scene, cam)
      const src = gl.domElement, out = document.createElement('canvas'); out.width = out.height = S
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

/** Kameranı seçilmiş baxışa yumşaq aparır (istifadəçi sonra sərbəst fırlada bilər). */
interface OrbitImpl { target: THREE.Vector3; update: () => void }
function Rig({ view }: { view: View }) {
  const controls = useThree((s) => s.controls) as unknown as OrbitImpl | null
  const camera = useThree((s) => s.camera)
  const left = useRef(0)
  const to = useMemo(() => ({ pos: new THREE.Vector3(...VIEWS[view].pos), target: new THREE.Vector3(...VIEWS[view].target) }), [view])
  useEffect(() => { left.current = 1.1 }, [view])
  useFrame((_, dt) => {
    if (!controls || left.current <= 0) return
    left.current -= dt
    const k = 1 - Math.exp(-dt * 7)
    camera.position.lerp(to.pos, k); controls.target.lerp(to.target, k); controls.update()
  })
  return null
}
/** Döşəmədə yumşaq işıq ləkəsi (kənarlara doğru əriyir). */
function useSpot() {
  return useMemo(() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256
    const g = cv.getContext('2d')!, gr = g.createRadialGradient(128, 128, 0, 128, 128, 128)
    gr.addColorStop(0, 'rgba(255,255,255,.2)'); gr.addColorStop(0.55, 'rgba(255,255,255,.07)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256)
    return new THREE.CanvasTexture(cv)
  }, [])
}

/** Studiya: yumşaq üç nöqtəli işıq, prosedur mühit xəritəsi (şəbəkəsiz), döşəmədə kölgə və işıq ləkəsi. */
function Stage({ cfg, capRef, hq, view, spin }: { cfg: AvatarConfig; capRef: React.RefObject<CaptureApi | null>; hq: boolean; view: View; spin: boolean }) {
  const spot = useSpot()
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: VIEWS.full.pos, fov: 30 }} gl={{ preserveDrawingBuffer: true, alpha: true, antialias: !hq, powerPreference: 'high-performance' }} aria-label={V.title}>
      <hemisphereLight args={['#FFFFFF', '#5A5F86', 0.75]} />
      <directionalLight position={[2.4, 4.4, 4]} intensity={1.9} color="#FFF6EC" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02} shadow-radius={8}
        shadow-camera-left={-2} shadow-camera-right={2} shadow-camera-top={3} shadow-camera-bottom={-0.5} />
      <directionalLight position={[-3.5, 2.4, 2.5]} intensity={0.6} color="#C9D6FF" />
      <directionalLight position={[-1.5, 3, -4]} intensity={1.1} color="#FFFFFF" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2} color="#FFFFFF" position={[2.5, 3.5, 3]} scale={[5, 3, 1]} target={[0, 1.1, 0]} />
        <Lightformer form="rect" intensity={1} color="#DCE6FF" position={[-3.5, 2, 2]} scale={[3, 3, 1]} target={[0, 1.1, 0]} />
        <Lightformer form="rect" intensity={1.4} color="#FFFFFF" position={[0, 3, -4]} scale={[5, 2, 1]} target={[0, 1.1, 0]} />
        <Lightformer form="rect" intensity={0.6} color="#FFFFFF" position={[0, -1, 0]} rotation-x={Math.PI / 2} scale={[6, 6, 1]} />
      </Environment>
      <Suspense fallback={null}><Character cfg={cfg} interactive /></Suspense>
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[2.4, 64]} /><meshBasicMaterial map={spot} transparent depthWrite={false} toneMapped={false} /></mesh>
      <ContactShadows position={[0, 0.004, 0]} opacity={0.5} scale={4} blur={2.6} far={1.8} resolution={512} />
      <OrbitControls makeDefault target={VIEWS.full.target} enablePan={false} minDistance={2.6} maxDistance={8} minPolarAngle={0.8} maxPolarAngle={1.72} enableDamping autoRotate={spin} autoRotateSpeed={2.2} />
      <Rig view={view} />
      <Capturer ref={capRef} />
      {hq && (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <N8AO aoRadius={0.3} intensity={1.6} distanceFalloff={0.6} quality="medium" halfRes />
          <Bloom luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.25} mipmapBlur />
          <SMAA />
        </EffectComposer>
      )}
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
  // geri al / təkrarla: eyni sahənin ardıcıl dəyişiklikləri (məs. rəng seçicini sürüşdürmək) bir addım sayılır
  const [st, setSt] = useState<{ cfg: AvatarConfig; past: AvatarConfig[]; future: AvatarConfig[] }>({ cfg: DEFAULT_AVATAR, past: [], future: [] })
  const cfg = st.cfg
  const last = useRef({ key: '', at: 0 })
  const setCfgRaw = useCallback((next: AvatarConfig | ((c: AvatarConfig) => AvatarConfig)) => setSt((s) => ({ ...s, cfg: typeof next === 'function' ? next(s.cfg) : next })), [])
  const change = useCallback((next: AvatarConfig | ((c: AvatarConfig) => AvatarConfig), key = '') => {
    const now = Date.now(), merge = !!key && key === last.current.key && now - last.current.at < 900
    last.current = { key, at: now }
    setSt((s) => ({ cfg: typeof next === 'function' ? next(s.cfg) : next, past: merge ? s.past : [...s.past.slice(-59), s.cfg], future: [] }))
  }, [])
  const undo = () => { last.current.key = ''; setSt((s) => (s.past.length ? { cfg: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [...s.future, s.cfg] } : s)) }
  const redo = () => { last.current.key = ''; setSt((s) => (s.future.length ? { cfg: s.future[s.future.length - 1], past: [...s.past, s.cfg], future: s.future.slice(0, -1) } : s)) }
  // yüksək keyfiyyət (AO, bloom, SMAA) — güclü cihazlarda; zəif telefonlarda sürət üçün söndürülür
  const [hq] = useState(() => { try { return !matchMedia('(max-width: 640px)').matches && (navigator.hardwareConcurrency ?? 4) >= 4 && !new URLSearchParams(location.search).has('lq') } catch { return false } })
  // inkişaf rejimi: avtomatlaşdırılmış vizual yoxlama üçün konfiqurasiyanı xaricdən təyin etmək
  useEffect(() => {
    if (!import.meta.env.DEV) return
    ;(window as unknown as { __setAvatar?: (c: Partial<AvatarConfig>) => void }).__setAvatar = (c) => setCfgRaw((x) => ({ ...x, ...c }))
  }, [setCfgRaw])
  const [saved, setSaved] = useState<string>(JSON.stringify(DEFAULT_AVATAR))
  const [ready, setReady] = useState(false)
  const [cat, setCat] = useState<Cat>('presets')
  const [spin, setSpin] = useState(false)
  const [busy, setBusy] = useState(false)
  const capRef = useRef<CaptureApi | null>(null)
  useEffect(() => {
    if (!user) return
    void loadAvatar(user.uid).then((a) => { if (a) { setCfgRaw(a.config); setSaved(JSON.stringify(a.config)); setCat('body') } }).finally(() => setReady(true))
  }, [user, setCfgRaw])
  const dirty = ready && JSON.stringify(cfg) !== saved
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])
  const set = useCallback(<K extends keyof AvatarConfig>(k: K, v: AvatarConfig[K]) => change((c) => ({ ...c, [k]: v }), k), [change])
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
  const download = () => {
    if (!capRef.current) return
    const a = document.createElement('a'); a.href = capRef.current.capture(bg, 1024); a.download = 'jabr-avatar.webp'; a.click()
  }
  const panels: Record<Cat, React.ReactNode> = useMemo(() => ({
    presets: <>
      <p className="text-sm text-muted">{V.presetsHint}</p>
      <div className="grid grid-cols-2 gap-2.5">
        {PRESETS.map((p) => {
          const c = { ...DEFAULT_AVATAR, glasses: 'none', hat: 'none', back: 'none', neck: 'none', hand: 'none', facial: 'none', ...p.c } as AvatarConfig
          return (
            <button key={p.id} type="button" onClick={() => change({ ...c, skin: cfg.skin })}
              className="group flex items-center gap-3 rounded-2xl border border-line bg-white/[.02] p-3 text-left transition hover:border-orange-400/50 hover:bg-white/[.05]">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl" style={{ background: `linear-gradient(135deg, ${BACKGROUNDS[c.bg][0]}, ${BACKGROUNDS[c.bg][1]})` }} aria-hidden>{p.e}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{V.presets[p.id]}</span>
                <span className="mt-1 flex gap-1">{[c.topColor, c.bottomColor, c.hairColor, c.shoeColor].map((x, i) => <span key={i} className="h-3 w-3 rounded-full border border-white/20" style={{ background: x }} />)}</span>
              </span>
            </button>
          )
        })}
      </div>
      <button type="button" className="btn btn-secondary" onClick={() => change(randomAvatar())}><Dices />{V.random}</button>
    </>,
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
  }), [cfg, set, change])

  if (loading) return <div className="bg-app flex min-h-dvh items-center justify-center"><Spinner /></div>
  if (!user || user.isAnonymous) return <Navigate to={`/start?next=/avatar`} replace />
  const canUndo = st.past.length > 0, canRedo = st.future.length > 0
  const tool = 'btn btn-sm border-white/15 bg-black/30 text-[#fff] backdrop-blur hover:bg-black/45 disabled:opacity-40'
  return (
    <StudentShell back="-1" title={V.title} width="max-w-7xl" actions={
      <button className="btn btn-primary btn-sm" disabled={busy || !dirty} onClick={() => void save()}>{busy ? <Loader2 className="animate-spin" /> : <Save />}<span className="hidden sm:inline">{busy ? V.saving : V.save}</span></button>
    }>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_460px]">
        <section className="theme-dark relative overflow-hidden rounded-[var(--radius)] border border-line lg:sticky lg:top-20 lg:h-[calc(100dvh-7rem)]"
          style={{ background: `radial-gradient(85% 65% at 50% 38%, color-mix(in srgb, ${bg[0]} 72%, #fff) 0%, ${bg[0]} 45%, ${bg[1]} 100%)` }}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_40%,transparent_55%,rgba(8,9,20,.45)_100%)]" />
          <div className="h-[56dvh] min-h-80 lg:h-full">{ready ? <Stage cfg={cfg} capRef={capRef} hq={hq} view={CAT_VIEW[cat]} spin={spin} /> : <div className="flex h-full items-center justify-center"><Spinner /></div>}</div>
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            <button className={tool} onClick={() => change(randomAvatar())}><Dices /><span className="hidden sm:inline">{V.random}</span></button>
            <button className={`${tool} btn-icon`} disabled={!canUndo} onClick={undo} aria-label={V.undo} title={V.undo}><Undo2 /></button>
            <button className={`${tool} btn-icon`} disabled={!canRedo} onClick={redo} aria-label={V.redo} title={V.redo}><Redo2 /></button>
            <button className={`${tool} btn-icon`} onClick={() => change(DEFAULT_AVATAR)} aria-label={V.reset} title={V.reset}><RotateCcw /></button>
          </div>
          <div className="absolute right-3 top-3 flex gap-2">
            {dirty && <span className="hidden items-center rounded-full bg-amber-400/90 px-3 text-xs font-semibold text-black sm:flex">{V.unsaved}</span>}
            <button className={`${tool} btn-icon ${spin ? 'bg-white/25' : ''}`} aria-pressed={spin} onClick={() => setSpin((x) => !x)} aria-label={V.spin} title={V.spin}><RotateCw className={spin ? 'animate-spin [animation-duration:3s]' : ''} /></button>
            <button className={`${tool} btn-icon`} onClick={download} aria-label={V.download} title={V.download}><Download /></button>
          </div>
          <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5 text-xs font-medium text-white/85 backdrop-blur"><Move3d className="h-3.5 w-3.5" />{V.rotate}</span>
            <div className="flex gap-1 rounded-full bg-black/30 p-1 backdrop-blur" role="radiogroup" aria-label={V.f.pose}>
              {(OPTIONS.pose as readonly Opt[]).map((p) => (
                <button key={p.id} type="button" role="radio" aria-checked={cfg.pose === p.id} title={label(p)} onClick={() => set('pose', p.id as AvatarConfig['pose'])}
                  className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-[#fff] transition ${cfg.pose === p.id ? 'bg-white/25' : 'hover:bg-white/10'}`}><span className="text-base" aria-hidden>{p.e}</span><span className="hidden md:inline">{label(p)}</span></button>
              ))}
            </div>
          </div>
        </section>

        <section className="card flex min-h-0 flex-col overflow-hidden lg:h-[calc(100dvh-7rem)]">
          <div className="border-b border-line p-3">
            <h1 className="flex items-center gap-2 px-1 font-sans text-lg font-semibold"><Sparkles className="h-4 w-4 text-orange-300" />{V.title}</h1>
            <p className="mb-3 px-1 text-xs text-muted">{V.sub}</p>
            <div className="grid grid-cols-4 gap-1" role="tablist">
              {CATS.map((k) => {
                const Icon = CAT_ICON[k], on = cat === k
                return (
                  <button key={k} type="button" role="tab" aria-selected={on} onClick={() => setCat(k)} title={V.cats[k]}
                    className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10.5px] font-semibold transition ${on ? 'bg-white/[.08] text-fg' : 'text-muted hover:bg-white/[.04] hover:text-fg'}`}>
                    <Icon className={`h-[18px] w-[18px] ${on ? 'text-orange-300' : ''}`} /><span className="max-w-full truncate">{V.cats[k]}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4 scrollbar-thin" role="tabpanel">{panels[cat]}</div>
          <div className="flex items-center gap-2 border-t border-line p-3">
            <span className={`mr-auto text-xs ${dirty ? 'text-amber-300' : 'text-muted'}`}>{dirty ? V.unsaved : V.savedHint}</span>
            <button className="btn btn-primary" disabled={busy || !dirty} onClick={() => void save()}>{busy ? <Loader2 className="animate-spin" /> : <Save />}{busy ? V.saving : V.save}</button>
          </div>
        </section>
      </div>
    </StudentShell>
  )
}
