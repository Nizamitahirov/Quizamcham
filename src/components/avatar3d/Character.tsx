/**
 * Prosedur 3D personaj — "kolleksiya oyuncaq fiquru" üslubu: iri baş, yığcam bədən, hamar formalar.
 * Üz və üst geyimin detalları toxuma kimi çəkilir (paint.ts), qalanı sadə həndəsədir — xarici model faylı yoxdur.
 * Koordinatlar: ayaq y=0, baş mərkəzi y=HEAD_Y, üz +z istiqamətində. Baş qrupunun daxili ölçüsü: radius 0.5.
 */
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import type { AvatarConfig } from '../../lib/avatar3d'
import { FACE, paintFace, paintTorso, shade, TORSO } from './paint'

export const HEAD_Y = 1.5
const BUILD = { slim: 0.9, regular: 1, broad: 1.13 } as const
const GOLD = '#FFC531'
type V3 = [number, number, number]
type Hair = AvatarConfig['hair']

/** Tutqun "vinil" material: yumşaq parıltı, yüngül lak qatı. */
function M({ c, r = 0.55, m = 0, cc = 0.22, e, o, map, side }: { c?: string; r?: number; m?: number; cc?: number; e?: string; o?: number; map?: THREE.Texture | null; side?: THREE.Side }) {
  return <meshPhysicalMaterial color={c ?? '#fff'} map={map ?? null} roughness={r} metalness={m} clearcoat={cc} clearcoatRoughness={0.5} emissive={e ?? '#000'} emissiveIntensity={e ? 1.4 : 0}
    transparent={o != null} opacity={o ?? 1} side={side} envMapIntensity={0.9} />
}
/** Ellips formalı "damla" — saç, aksesuar və s. üçün əsas tikinti bloku. */
function Blob({ p, s, c, rot, r, m, cc, e, o }: { p: V3; s: V3 | number; c: string; rot?: V3; r?: number; m?: number; cc?: number; e?: string; o?: number }) {
  return <mesh position={p} scale={s} rotation={rot} castShadow><sphereGeometry args={[1, 32, 24]} /><M c={c} r={r} m={m} cc={cc} e={e} o={o} /></mesh>
}
/** Kürə örtüyü (təpədən aşağı thetaLen qədər), arxaya əyilmiş — saç dibi və papaqlar üçün. */
function Shell({ r, len, tilt = 0, c, rough, y = 0 }: { r: number; len: number; tilt?: number; c: string; rough?: number; y?: number }) {
  return <mesh rotation={[-tilt, 0, 0]} position={[0, y, 0]} castShadow><sphereGeometry args={[r, 48, 28, 0, Math.PI * 2, 0, len]} /><M c={c} r={rough ?? 0.7} side={THREE.DoubleSide} /></mesh>
}

// ───────────────────────── gövdə profili ─────────────────────────
const PROFILE: [number, number][] = [[0.46, 0], [0.475, 0.14], [0.51, 0.235], [0.6, 0.268], [0.72, 0.266], [0.84, 0.252], [0.94, 0.232], [1.0, 0.202], [1.05, 0.15], [1.085, 0.085], [1.1, 0]]
/** Hamar profil (Catmull-Rom) — bir dəfə sıx nümunələnir, sonra y üzrə axtarılır. */
const SAMPLES = new THREE.SplineCurve(PROFILE.map(([y, r]) => new THREE.Vector2(r, y))).getPoints(240)
function torsoR(y: number) {
  for (let i = 1; i < SAMPLES.length; i++) if (y <= SAMPLES[i].y) {
    const a = SAMPLES[i - 1], b = SAMPLES[i], k = b.y === a.y ? 0 : (y - a.y) / (b.y - a.y)
    return Math.max(0, a.x + (b.x - a.x) * k)
  }
  return 0
}
const TORSO_Z = 0.84
function useTorsoGeo() {
  return useMemo(() => {
    const N = 40, pts: THREE.Vector2[] = []
    for (let i = 0; i <= N; i++) { const y = TORSO.y0 + (i / N) * (TORSO.y1 - TORSO.y0); pts.push(new THREE.Vector2(Math.max(0.0001, torsoR(y)), y)) }
    return new THREE.LatheGeometry(pts, 56, Math.PI, Math.PI * 2) // tikiş arxada, u=0.5 öndə
  }, [])
}

// ───────────────────────── üz ─────────────────────────
function Face({ cfg, still }: { cfg: AvatarConfig; still: boolean }) {
  const key = [cfg.eyes, cfg.eyeColor, cfg.brows, cfg.mouth, cfg.blush, cfg.freckles, cfg.facial, cfg.hairColor, cfg.skin].join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const maps = useMemo(() => ({ open: paintFace(cfg, false), shut: paintFace(cfg, true) }), [key])
  useEffect(() => () => { maps.open.dispose(); maps.shut.dispose() }, [maps])
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(({ clock }) => {
    if (!mat.current || still) return
    const t = clock.elapsedTime % 4.2, shut = t > 4.05 || (t > 1.9 && t < 1.98)
    const want = shut ? maps.shut : maps.open
    if (mat.current.map !== want) { mat.current.map = want; mat.current.needsUpdate = true }
  })
  return (
    <mesh renderOrder={2}>
      <sphereGeometry args={[0.5035, 48, 48, Math.PI / 2 - FACE.phi, FACE.phi * 2, FACE.theta0, FACE.thetaLen]} />
      <meshBasicMaterial ref={mat} map={maps.open} transparent depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  )
}

function heartShape(k: number) {
  const s = new THREE.Shape()
  s.moveTo(0, -0.9 * k); s.bezierCurveTo(-1.3 * k, 0, -0.7 * k, 1.05 * k, 0, 0.45 * k); s.bezierCurveTo(0.7 * k, 1.05 * k, 1.3 * k, 0, 0, -0.9 * k)
  return s
}
const EYE: V3 = [0.162, -0.012, 0.478]
function Glasses({ kind, color }: { kind: AvatarConfig['glasses']; color: string }) {
  if (kind === 'none') return null
  if (kind === 'visor') return (
    <group position={[0, EYE[1], 0]}>
      <mesh castShadow><cylinderGeometry args={[0.535, 0.535, 0.17, 48, 1, true, -1.2, 2.4]} /><M c={color} r={0.15} m={0.3} cc={1} e={shade(color, 0.12)} side={THREE.DoubleSide} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.515, 0.03, 10, 48]} /><M c="#1B1D2E" r={0.4} /></mesh>
    </group>
  )
  const lens = kind === 'sun' ? '#14151F' : kind === 'heart' ? '#FF8FB8' : '#DCEBFF'
  const one = (side: 1 | -1) => (
    <group key={side} position={[side * EYE[0], EYE[1], EYE[2] + 0.035]} rotation={[0, side * 0.33, 0]}>
      {kind === 'heart' ? <>
        <mesh position={[0, 0.01, 0]}><extrudeGeometry args={[heartShape(0.105), { depth: 0.02, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.01, bevelSegments: 3 }]} /><M c={color} r={0.35} /></mesh>
        <mesh position={[0, 0.01, 0.034]}><shapeGeometry args={[heartShape(0.082)]} /><M c={lens} r={0.1} cc={1} o={0.75} /></mesh>
      </> : kind === 'square' ? <>
        <RoundedBox args={[0.215, 0.165, 0.03]} radius={0.035} smoothness={4} castShadow><M c={color} r={0.35} /></RoundedBox>
        <RoundedBox args={[0.172, 0.122, 0.036]} radius={0.025} smoothness={4}><M c="#CFE3FF" r={0.08} cc={1} o={0.9} /></RoundedBox>
      </> : <>
        <mesh castShadow><torusGeometry args={[0.098, kind === 'sun' ? 0.017 : 0.014, 12, 40]} /><M c={color} r={0.35} m={kind === 'monocle' ? 0.8 : 0} /></mesh>
        <mesh><circleGeometry args={[0.096, 40]} /><M c={lens} r={0.08} cc={1} o={kind === 'sun' ? 0.94 : 0.32} /></mesh>
      </>}
    </group>
  )
  if (kind === 'monocle') return (
    <group>
      {one(1)}
      <mesh position={[0.3, -0.2, 0.42]} rotation={[0, 0, -0.25]}><cylinderGeometry args={[0.004, 0.004, 0.36, 6]} /><M c={GOLD} m={0.9} r={0.25} /></mesh>
    </group>
  )
  return (
    <group>
      {one(1)}{one(-1)}
      <mesh position={[0, EYE[1] + 0.01, EYE[2] + 0.062]} rotation={[0, 0, Math.PI / 2]}><capsuleGeometry args={[0.012, 0.09, 4, 10]} /><M c={color} r={0.35} /></mesh>
      {([1, -1] as const).map((s) => <mesh key={s} position={[s * 0.4, EYE[1] + 0.005, 0.27]} rotation={[Math.PI / 2, 0, s * 0.42]}><capsuleGeometry args={[0.011, 0.4, 4, 8]} /><M c={color} r={0.35} /></mesh>)}
    </group>
  )
}

// ───────────────────────── saç ─────────────────────────
const TILT = 0.46
/** Papaq altında qalan saç: yalnız yanlar və arxa (üst həcmlər gizlədilir). */
function HairStyle({ kind, c, hat }: { kind: Hair; c: string; hat: boolean }) {
  const hi = shade(c, 0.03)
  const base = (len = 0.53, r = 0.528) => <Shell r={r} len={Math.PI * len} tilt={TILT} c={c} />
  /** təpədə yumşaq həcm (örtüklə birləşir) */
  const dome = (h = 0.38, w = 0.515) => <Blob p={[0, 0.2, -0.04]} s={[w, h, w]} c={c} r={0.7} />
  /** yana daranmış kəkil: üst-üstə düşən iki tutam */
  const fringe = (x = 0, w = 0.34, lift = 0) => <>
    <Blob p={[x + 0.06, 0.33 + lift, 0.325]} s={[w * 0.86, 0.105, 0.175]} rot={[0.7, 0, -0.22]} c={hi} r={0.7} />
    <Blob p={[x - 0.2, 0.305 + lift, 0.3]} s={[w * 0.5, 0.09, 0.15]} rot={[0.62, 0, 0.5]} c={c} r={0.7} />
  </>
  if (kind === 'bald') return null
  if (kind === 'buzz') return <Shell r={0.509} len={Math.PI * 0.5} tilt={TILT} c={c} rough={0.95} />
  if (kind === 'short') return <>{base()}{!hat && <>{dome()}{fringe(0, 0.36)}</>}</>
  if (kind === 'sidepart') return <>{base()}{!hat && <>
    <Blob p={[0.1, 0.36, 0.27]} s={[0.36, 0.14, 0.25]} rot={[0.5, 0, -0.32]} c={hi} r={0.7} />
    <Blob p={[-0.3, 0.3, 0.2]} s={[0.17, 0.12, 0.26]} rot={[0.4, 0, 0.5]} c={c} r={0.7} />
    {dome(0.39)}</>}</>
  if (kind === 'curly' || kind === 'afro') {
    if (kind === 'afro' && !hat) return <>
      <Blob p={[0, 0.27, -0.09]} s={0.62} c={c} r={0.95} cc={0} />
      {Array.from({ length: 70 }, (_, i) => { const a = i * 2.39996, y = 1 - (i + 0.5) / 70 * 1.5, rr = Math.sqrt(Math.max(0, 1 - y * y)); return <Blob key={i} p={[Math.cos(a) * rr * 0.55, 0.27 + y * 0.55, -0.09 + Math.sin(a) * rr * 0.55]} s={0.125} c={c} r={0.95} cc={0} /> })}
    </>
    const n = hat ? 0 : 34
    return <>{base(0.54)}
      {Array.from({ length: n }, (_, i) => { const a = i * 2.39996, y = 1 - (i + 0.5) / n * 0.9, rr = Math.sqrt(Math.max(0, 1 - y * y)); const v = new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr).applyAxisAngle(new THREE.Vector3(1, 0, 0), -TILT).multiplyScalar(0.535); return <Blob key={i} p={[v.x, v.y, v.z]} s={0.105} c={i % 2 ? hi : c} r={0.9} cc={0} /> })}
      {hat && ([1, -1] as const).map((s) => <Blob key={s} p={[s * 0.5, -0.02, -0.08]} s={kind === 'afro' ? 0.2 : 0.13} c={c} r={0.9} cc={0} />)}
      {hat && <Blob p={[0, -0.08, -0.46]} s={[0.3, 0.16, 0.14]} c={c} r={0.9} cc={0} />}
    </>
  }
  if (kind === 'bun') return <>{base()}{!hat && <>{fringe(0, 0.34, 0.02)}<Blob p={[0, 0.56, -0.14]} s={0.17} c={hi} r={0.7} /><mesh position={[0, 0.44, -0.12]} rotation={[Math.PI / 2 - 0.2, 0, 0]}><torusGeometry args={[0.1, 0.025, 10, 24]} /><M c={shade(c, -0.1)} /></mesh></>}{hat && <Blob p={[0, -0.1, -0.52]} s={0.14} c={hi} r={0.7} />}</>
  if (kind === 'ponytail') return <>{base()}{!hat && fringe(-0.06, 0.34)}
    <Blob p={[0, 0.1, -0.53]} s={0.115} c={shade(c, -0.08)} r={0.7} />
    <Blob p={[0, -0.16, -0.62]} s={[0.115, 0.3, 0.12]} rot={[0.28, 0, 0]} c={hi} r={0.7} />
    <Blob p={[0, -0.4, -0.66]} s={[0.07, 0.12, 0.07]} rot={[0.2, 0, 0]} c={hi} r={0.7} /></>
  if (kind === 'long' || kind === 'wavy') return <>{base(0.55)}
    <Blob p={[0, -0.2, -0.17]} s={[0.545, 0.56, 0.4]} c={c} r={0.7} />
    {([1, -1] as const).map((s) => <group key={s}>
      <Blob p={[s * 0.47, -0.2, 0.1]} s={[0.085, 0.36, 0.13]} rot={[0, 0, s * 0.06]} c={hi} r={0.7} />
      {kind === 'wavy' && [0, 1, 2, 3].map((i) => <Blob key={i} p={[s * (0.53 + (i % 2) * 0.05), -0.05 - i * 0.17, -0.08]} s={[0.12, 0.13, 0.22]} c={i % 2 ? c : hi} r={0.7} />)}
    </group>)}
    {!hat && <><Blob p={[0.16, 0.33, 0.32]} s={[0.25, 0.11, 0.18]} rot={[0.6, 0, -0.5]} c={hi} r={0.7} /><Blob p={[-0.18, 0.33, 0.31]} s={[0.23, 0.11, 0.18]} rot={[0.6, 0, 0.5]} c={hi} r={0.7} /></>}</>
  if (kind === 'bob') return <>{base(0.55)}
    <Blob p={[0, -0.04, -0.1]} s={[0.57, 0.41, 0.46]} c={c} r={0.7} />
    {([1, -1] as const).map((s) => <Blob key={s} p={[s * 0.46, -0.1, 0.13]} s={[0.1, 0.27, 0.15]} c={hi} r={0.7} />)}
    {!hat && <Blob p={[0, 0.28, 0.35]} s={[0.4, 0.11, 0.16]} rot={[0.66, 0, 0]} c={hi} r={0.7} />}</>
  if (kind === 'mohawk') return <><Shell r={0.509} len={Math.PI * 0.5} tilt={TILT} c={shade(c, -0.08)} rough={0.95} />
    {!hat && [0, 1, 2, 3, 4, 5, 6].map((i) => { const a = -0.75 + i * 0.36; return <Blob key={i} p={[0, Math.cos(a) * 0.56, -Math.sin(a) * 0.56 + 0.02]} s={[0.085, 0.2 - Math.abs(i - 3) * 0.014, 0.14]} rot={[-a, 0, 0]} c={i % 2 ? hi : c} r={0.7} /> })}</>
  if (kind === 'spiky') return <>{base()}{!hat && Array.from({ length: 13 }, (_, i) => {
    const a = i * 2.39996, y = 1 - (i + 0.5) / 13 * 0.75, rr = Math.sqrt(1 - y * y)
    const v = new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr).applyAxisAngle(new THREE.Vector3(1, 0, 0), -0.25)
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize()), e = new THREE.Euler().setFromQuaternion(q)
    return <mesh key={i} position={[v.x * 0.58, v.y * 0.58, v.z * 0.58]} rotation={e} castShadow><coneGeometry args={[0.135, 0.3, 14]} /><M c={i % 2 ? hi : c} r={0.7} /></mesh>
  })}</>
  // pigtails
  return <>{base()}{!hat && fringe(0, 0.36)}
    {([1, -1] as const).map((s) => <group key={s}>
      <Blob p={[s * 0.55, 0.04, -0.06]} s={0.15} c={hi} r={0.7} />
      <Blob p={[s * 0.62, -0.22, -0.06]} s={[0.115, 0.22, 0.115]} rot={[0, 0, s * 0.2]} c={c} r={0.7} />
      <mesh position={[s * 0.5, 0.1, -0.06]} rotation={[0, 0, Math.PI / 2 + s * 0.3]}><torusGeometry args={[0.06, 0.022, 8, 20]} /><M c="#FF5C8A" /></mesh>
    </group>)}</>
}
/** Saçın təpə hündürlüyü — tac, halə və s. üçün. */
const hairTop = (k: Hair) => (k === 'afro' ? 0.86 : k === 'bun' ? 0.7 : k === 'mohawk' || k === 'spiky' ? 0.7 : k === 'bald' || k === 'buzz' ? 0.5 : 0.56)

// ───────────────────────── papaqlar ─────────────────────────
const COVERING = ['cap', 'backcap', 'beanie', 'bucket', 'beret', 'cowboy', 'tophat', 'wizard', 'bandana'] as const
const covers = (h: AvatarConfig['hat']) => (COVERING as readonly string[]).includes(h)
function lathe(pts: [number, number][], seg = 48) { return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg) }
function Hat({ kind, c }: { kind: AvatarConfig['hat']; c: string }) {
  const dk = shade(c, -0.1), R = 0.545
  const brimGeo = useMemo(() => kind === 'bucket' ? lathe([[0.5, 0.02], [0.6, -0.04], [0.74, -0.15], [0.75, -0.17], [0.6, -0.06], [0.5, 0]])
    : kind === 'cowboy' ? lathe([[0.4, 0.0], [0.58, -0.02], [0.72, 0.04], [0.77, 0.11], [0.75, 0.13], [0.58, 0.02], [0.4, 0.03]])
    : kind === 'wizard' ? lathe([[0.3, 0.02], [0.56, -0.01], [0.72, -0.04], [0.73, -0.02], [0.56, 0.03], [0.3, 0.05]])
    : kind === 'tophat' ? lathe([[0.3, 0.0], [0.62, 0.0], [0.66, 0.03], [0.62, 0.04], [0.3, 0.04]]) : null, [kind])
  if (kind === 'none') return null
  // ── başı örtən papaqlar: arxaya əyilmiş qrup (ön kənar alında, arxa ənsədə)
  if (kind === 'cap' || kind === 'backcap') return (
    <group rotation={[-0.2, kind === 'backcap' ? Math.PI : 0, 0]}>
      <Shell r={R} len={Math.PI * 0.46} c={c} rough={0.75} />
      <mesh position={[0, 0.535, 0]}><sphereGeometry args={[0.035, 12, 10]} /><M c={dk} /></mesh>
      <mesh position={[0, 0.0, 0.6]} rotation={[0.42, 0, 0]} scale={[1, 0.16, 0.9]} castShadow><sphereGeometry args={[0.36, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /><M c={dk} r={0.6} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 0.22, 0.5]} rotation={[-0.4, 0, 0]}><circleGeometry args={[0.085, 24]} /><M c="#fff" r={0.6} /></mesh>
    </group>
  )
  if (kind === 'beanie') return (
    <group rotation={[-0.34, 0, 0]}>
      <Shell r={R} len={Math.PI * 0.5} c={c} rough={0.95} y={0.02} />
      <mesh position={[0, 0.03, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow><torusGeometry args={[0.535, 0.07, 14, 48]} /><M c={dk} r={0.95} cc={0} /></mesh>
      <Blob p={[0, 0.6, 0]} s={0.11} c="#F5F5F7" r={1} cc={0} />
    </group>
  )
  if (kind === 'bandana') return (
    <group rotation={[-0.38, 0, 0]}>
      <Shell r={0.522} len={Math.PI * 0.47} c={c} rough={0.8} />
      <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.52, 0.035, 10, 48]} /><M c={dk} r={0.8} /></mesh>
      <Blob p={[0, 0.02, -0.56]} s={0.07} c={dk} />
      {([1, -1] as const).map((s) => <Blob key={s} p={[s * 0.09, -0.1, -0.6]} s={[0.05, 0.13, 0.03]} rot={[0.3, 0, s * 0.5]} c={c} />)}
      {[0, 1, 2, 3, 4].map((i) => <Blob key={i} p={[Math.sin(i * 1.3 + 0.4) * 0.3, 0.42 - (i % 2) * 0.08, 0.26 * Math.cos(i * 1.3 + 0.4)]} s={0.035} c="#fff" />)}
    </group>
  )
  if (kind === 'beret') return (
    <group position={[0.04, 0.26, -0.02]} rotation={[-0.2, 0, -0.24]}>
      <Blob p={[0.06, 0.1, 0]} s={[0.54, 0.14, 0.52]} c={c} r={0.9} cc={0} />
      <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.44, 0.04, 10, 40]} /><M c={dk} r={0.9} /></mesh>
      <mesh position={[0, 0.27, 0]}><cylinderGeometry args={[0.015, 0.02, 0.07, 8]} /><M c={dk} /></mesh>
    </group>
  )
  // ── kənarlı papaqlar
  const rim = kind === 'bucket' ? 0.16 : 0.24
  return (
    <group position={[0, rim, 0]} rotation={[-0.2, 0, 0]}>
      {brimGeo && <mesh geometry={brimGeo} castShadow receiveShadow><M c={kind === 'bucket' ? c : dk} r={0.75} side={THREE.DoubleSide} /></mesh>}
      {kind === 'bucket' && <Shell r={R} len={Math.PI * 0.42} c={c} rough={0.8} y={-0.08} />}
      {kind === 'cowboy' && <>
        <mesh position={[0, 0.29, 0]} scale={[1, 1, 0.92]} castShadow><cylinderGeometry args={[0.34, 0.41, 0.56, 40]} /><M c={c} r={0.75} /></mesh>
        <Blob p={[0, 0.52, 0]} s={[0.34, 0.07, 0.31]} c={c} r={0.75} />
        <mesh position={[0, 0.07, 0]} scale={[1, 1, 0.92]}><cylinderGeometry args={[0.415, 0.42, 0.07, 40]} /><M c="#2A1A12" r={0.6} /></mesh>
        <Blob p={[0, 0.07, 0.39]} s={0.035} c={GOLD} m={0.9} r={0.3} />
      </>}
      {kind === 'tophat' && <>
        <mesh position={[0, 0.34, 0]} castShadow><cylinderGeometry args={[0.36, 0.33, 0.62, 44]} /><M c={c} r={0.4} cc={0.6} /></mesh>
        <mesh position={[0, 0.1, 0]}><cylinderGeometry args={[0.337, 0.335, 0.11, 44]} /><M c="#F0262F" r={0.5} /></mesh>
      </>}
      {kind === 'wizard' && <>
        <mesh position={[0, 0.52, -0.02]} rotation={[-0.1, 0, 0]} castShadow><coneGeometry args={[0.42, 1.02, 40]} /><M c={c} r={0.8} /></mesh>
        <Blob p={[0, 1.0, -0.12]} s={0.05} c={GOLD} e={GOLD} />
        <mesh position={[0, 0.07, 0]}><cylinderGeometry args={[0.405, 0.42, 0.08, 40]} /><M c={GOLD} m={0.8} r={0.3} /></mesh>
        {[0, 1, 2, 3, 4, 5].map((i) => { const a = i * 1.9, h = 0.2 + (i % 3) * 0.2, r = 0.42 * (1 - h / 1.02) + 0.012; return <Blob key={i} p={[Math.sin(a) * r, h + 0.02, Math.cos(a) * r - 0.02]} s={0.028} c={GOLD} e={GOLD} /> })}
      </>}
    </group>
  )
}
/** Başı örtməyən aksesuarlar (saçın üstündə oturur). */
function HeadTopper({ kind, c, top }: { kind: AvatarConfig['hat']; c: string; top: number }) {
  if (kind === 'crown') return (
    <group position={[0, top - 0.06, 0]} rotation={[-0.14, 0, 0]}>
      <mesh castShadow><cylinderGeometry args={[0.3, 0.27, 0.13, 40, 1, true]} /><M c={GOLD} m={0.95} r={0.22} side={THREE.DoubleSide} /></mesh>
      {Array.from({ length: 7 }, (_, i) => { const a = (i / 7) * Math.PI * 2; return <group key={i} position={[Math.sin(a) * 0.3, 0.11, Math.cos(a) * 0.3]}>
        <mesh castShadow><coneGeometry args={[0.065, 0.16, 4]} /><M c={GOLD} m={0.95} r={0.22} /></mesh>
        <Blob p={[0, 0.1, 0]} s={0.028} c={i % 2 ? '#F0262F' : '#3B82F6'} r={0.15} cc={1} />
      </group> })}
      <mesh position={[0, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.275, 0.02, 8, 40]} /><M c={GOLD} m={0.95} r={0.22} /></mesh>
    </group>
  )
  if (kind === 'halo') return <mesh position={[0, top + 0.16, 0]} rotation={[Math.PI / 2 - 0.12, 0, 0]}><torusGeometry args={[0.27, 0.032, 14, 48]} /><M c="#FFE9A3" e="#FFD45E" r={0.3} /></mesh>
  if (kind === 'headphones') return (
    <group>
      <mesh rotation={[0, 0, 0]} position={[0, 0.02, 0]}><torusGeometry args={[Math.max(0.56, top + 0.04), 0.03, 12, 48, Math.PI]} /><M c="#1B1D2E" r={0.4} /></mesh>
      {([1, -1] as const).map((s) => <group key={s} position={[s * 0.54, -0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
        <mesh castShadow><cylinderGeometry args={[0.15, 0.15, 0.1, 32]} /><M c={c} r={0.4} cc={0.6} /></mesh>
        <mesh position={[0, -s * 0.05, 0]}><cylinderGeometry args={[0.13, 0.15, 0.05, 32]} /><M c="#1B1D2E" r={0.8} /></mesh>
        <mesh position={[0, s * 0.052, 0]}><cylinderGeometry args={[0.07, 0.07, 0.01, 24]} /><M c="#fff" e={c} /></mesh>
      </group>)}
    </group>
  )
  if (kind === 'cat') return <>{([1, -1] as const).map((s) => <group key={s} position={[s * 0.27, top - 0.07, 0.02]} rotation={[0, 0, -s * 0.36]}>
    <mesh castShadow scale={[1, 1, 0.6]}><coneGeometry args={[0.14, 0.26, 4]} /><M c={c} r={0.8} /></mesh>
    <mesh position={[0, -0.01, 0.05]} scale={[0.6, 0.62, 0.3]}><coneGeometry args={[0.14, 0.26, 4]} /><M c="#FFB3C7" r={0.8} /></mesh>
  </group>)}</>
  if (kind === 'horns') return <>{([1, -1] as const).map((s) => <group key={s} position={[s * 0.26, top - 0.08, 0.04]} rotation={[0.1, 0, -s * 0.55]}>
    <mesh castShadow><coneGeometry args={[0.085, 0.27, 20]} /><M c={c} r={0.3} cc={0.8} /></mesh>
  </group>)}</>
  if (kind === 'flowers') return (
    <group position={[0, 0.2, 0]} rotation={[-0.32, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.535, 0.022, 8, 48]} /><M c="#3CCB7F" r={0.8} /></mesh>
      {Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2, col = ['#FF7AA8', '#FFC531', '#F5F5F7', '#A855F7'][i % 4]; return <group key={i} position={[Math.sin(a) * 0.545, 0.01, Math.cos(a) * 0.545]}>
        {[0, 1, 2, 3, 4].map((j) => <Blob key={j} p={[Math.cos(j * 1.257) * 0.042, Math.sin(j * 1.257) * 0.042, 0]} s={0.034} c={col} r={0.7} />)}
        <Blob p={[0, 0, 0.012]} s={0.026} c={GOLD} />
      </group> })}
    </group>
  )
  void c
  return null
}

// ───────────────────────── bədən hissələri ─────────────────────────
function Shoe({ x, kind, c, skin }: { x: number; kind: AvatarConfig['shoes']; c: string; skin: string }) {
  const sole = kind === 'boots' ? '#2A1A12' : kind === 'loafers' ? '#1B1D2E' : '#F5F5F7'
  if (kind === 'slides') return (
    <group position={[x, 0, 0.05]}>
      <Blob p={[0, 0.075, 0]} s={[0.1, 0.06, 0.17]} c={skin} />
      <RoundedBox args={[0.23, 0.045, 0.4]} radius={0.02} position={[0, 0.024, 0.01]} castShadow><M c={c} r={0.8} /></RoundedBox>
      <mesh position={[0, 0.085, 0.06]} rotation={[Math.PI / 2, 0, Math.PI / 2]} scale={[1, 1, 0.8]}><torusGeometry args={[0.105, 0.03, 10, 24, Math.PI]} /><M c={c} r={0.8} /></mesh>
    </group>
  )
  const tall = kind === 'hightops' ? 0.14 : kind === 'boots' ? 0.2 : 0
  return (
    <group position={[x, 0, 0.045]}>
      <RoundedBox args={[0.25, 0.05, 0.41]} radius={0.024} position={[0, 0.025, 0]} castShadow><M c={sole} r={0.7} /></RoundedBox>
      <Blob p={[0, 0.095, 0.0]} s={[0.118, kind === 'loafers' ? 0.07 : 0.09, 0.195]} c={c} r={kind === 'loafers' ? 0.3 : 0.6} cc={kind === 'loafers' ? 0.8 : 0.22} />
      {tall > 0 && <mesh position={[0, 0.12 + tall / 2, -0.045]} castShadow><cylinderGeometry args={[0.108, 0.115, tall, 24]} /><M c={c} r={0.6} /></mesh>}
      {kind === 'sneakers' && <Blob p={[0, 0.1, 0.15]} s={[0.1, 0.055, 0.07]} c="#F5F5F7" r={0.7} />}
      {kind === 'hightops' && <Blob p={[0, 0.1, 0.16]} s={[0.1, 0.06, 0.06]} c="#F5F5F7" r={0.7} />}
      {(kind === 'sneakers' || kind === 'hightops') && [0, 1].map((i) => <mesh key={i} position={[0, 0.172 - i * 0.012, 0.03 + i * 0.05]} rotation={[0, 0, Math.PI / 2]}><capsuleGeometry args={[0.008, 0.11, 3, 6]} /><M c="#F5F5F7" /></mesh>)}
      {kind === 'boots' && <mesh position={[0, 0.31, -0.045]}><torusGeometry args={[0.108, 0.018, 8, 24]} /><M c={shade(c, 0.12)} /></mesh>}
    </group>
  )
}

function Legs({ cfg, bw }: { cfg: AvatarConfig; bw: number }) {
  const dress = cfg.top === 'dress', kind = cfg.bottom, c = cfg.bottomColor, x = 0.118 * bw
  const bare = dress || kind === 'skirt', short = kind === 'shorts'
  const rr = kind === 'leggings' ? 0.086 : kind === 'cargo' || kind === 'joggers' ? 0.108 : 0.1
  const skirtGeo = useMemo(() => dress ? lathe([[0.262, 0.66], [0.3, 0.52], [0.37, 0.3], [0.385, 0.24], [0.36, 0.25], [0.2, 0.5]]) : lathe([[0.27, 0.6], [0.3, 0.5], [0.355, 0.33], [0.365, 0.3], [0.34, 0.31], [0.2, 0.5]]), [dress])
  return (
    <group>
      {([1, -1] as const).map((s) => (
        <group key={s} position={[s * x, 0, 0]}>
          {/* ayaq: dəri (şort/yubka/don) və ya şalvar */}
          <mesh position={[0, 0.3, 0]} castShadow><capsuleGeometry args={[bare || short ? 0.082 : rr, 0.36, 8, 20]} /><M c={bare || short ? cfg.skin : c} r={kind === 'jeans' ? 0.85 : 0.65} /></mesh>
          {short && !dress && <mesh position={[0, 0.43, 0]} castShadow><cylinderGeometry args={[0.112, 0.118, 0.22, 24]} /><M c={c} r={0.7} /></mesh>}
          {!bare && !short && kind === 'joggers' && <>
            <mesh position={[0, 0.135, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.092, 0.03, 10, 24]} /><M c={shade(c, -0.07)} r={0.9} /></mesh>
            <mesh position={[s * (rr + 0.001), 0.34, 0]}><boxGeometry args={[0.012, 0.36, 0.035]} /><M c="#F5F5F7" /></mesh>
          </>}
          {!bare && !short && kind === 'jeans' && <mesh position={[0, 0.15, 0]}><cylinderGeometry args={[rr + 0.012, rr + 0.012, 0.06, 24]} /><M c={shade(c, 0.14)} r={0.85} /></mesh>}
          {!bare && !short && kind === 'cargo' && <RoundedBox args={[0.07, 0.13, 0.13]} radius={0.02} position={[s * rr, 0.36, 0]} castShadow><M c={shade(c, -0.06)} r={0.8} /></RoundedBox>}
          <Shoe x={0} kind={cfg.shoes} c={cfg.shoeColor} skin={cfg.skin} />
        </group>
      ))}
      {(dress || kind === 'skirt') && <mesh geometry={skirtGeo} scale={[bw, 1, TORSO_Z + 0.06]} castShadow><M c={dress ? cfg.topColor : c} r={0.7} side={THREE.DoubleSide} /></mesh>}
      {dress && <mesh position={[0, 0.25, 0]} scale={[bw, 1, TORSO_Z + 0.06]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.378, 0.014, 8, 48]} /><M c={cfg.topColor2} /></mesh>}
    </group>
  )
}

const LONG = ['hoodie', 'jacket', 'sweater', 'shirt'] as const
function Arm({ side, cfg, refArm, children }: { side: 1 | -1; cfg: AvatarConfig; refArm: React.RefObject<THREE.Group | null>; children?: React.ReactNode }) {
  const long = (LONG as readonly string[]).includes(cfg.top), sleeve = cfg.top !== 'tank'
  const c = cfg.top === 'jacket' ? cfg.topColor : cfg.topColor
  return (
    <group ref={refArm}>
      <mesh position={[0, -0.19, 0]} castShadow><capsuleGeometry args={[0.074, 0.26, 8, 20]} /><M c={long ? c : cfg.skin} r={0.65} /></mesh>
      {sleeve && !long && <mesh position={[0, -0.09, 0]} castShadow><capsuleGeometry args={[0.086, 0.09, 8, 20]} /><M c={c} r={0.65} /></mesh>}
      {sleeve && !long && cfg.top === 'jersey' && <mesh position={[0, -0.175, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.08, 0.014, 8, 24]} /><M c={cfg.topColor2} /></mesh>}
      {long && <mesh position={[0, -0.335, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.07, 0.024, 10, 24]} /><M c={cfg.top === 'jacket' ? cfg.topColor2 : shade(c, -0.08)} r={0.9} /></mesh>}
      <Blob p={[0, -0.41, 0]} s={[0.085, 0.095, 0.085]} c={cfg.skin} />
      <Blob p={[-side * 0.012, -0.41, 0.07]} s={[0.03, 0.045, 0.035]} c={cfg.skin} />
      {children}
    </group>
  )
}

function Neck({ kind, c, zf }: { kind: AvatarConfig['neck']; c: string; zf: number }) {
  if (kind === 'none') return null
  if (kind === 'scarf') return (
    <group position={[0, 1.065, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1.05, 0.9, 1]} castShadow><torusGeometry args={[0.175, 0.075, 16, 40]} /><M c={c} r={0.95} cc={0} /></mesh>
      <RoundedBox args={[0.13, 0.3, 0.05]} radius={0.02} position={[0.12, -0.17, zf + 0.03]} rotation={[0.12, 0, -0.1]} castShadow><M c={c} r={0.95} cc={0} /></RoundedBox>
      {[0, 1].map((i) => <mesh key={i} position={[0.125, -0.24 + i * 0.07, zf + 0.06]} rotation={[0.12, 0, -0.1]}><boxGeometry args={[0.132, 0.022, 0.012]} /><M c={shade(c, 0.2)} /></mesh>)}
    </group>
  )
  if (kind === 'chain') return (
    <group position={[0, 1.0, 0.03]} rotation={[0.95, 0, 0]}>
      <mesh scale={[1, 1.25, 1]}><torusGeometry args={[0.165, 0.011, 8, 48]} /><M c={c} m={0.95} r={0.2} /></mesh>
      <Blob p={[0, -0.215, 0.0]} s={[0.04, 0.04, 0.015]} c={c} m={0.95} r={0.2} />
    </group>
  )
  if (kind === 'bowtie') return (
    <group position={[0, 0.995, zf + 0.035]}>
      {([1, -1] as const).map((s) => <mesh key={s} position={[s * 0.055, 0, 0]} rotation={[0, 0, s * Math.PI / 2]} scale={[1, 1, 0.5]} castShadow><coneGeometry args={[0.055, 0.1, 16]} /><M c={c} r={0.6} /></mesh>)}
      <Blob p={[0, 0, 0.005]} s={0.026} c={shade(c, -0.12)} />
    </group>
  )
  // medal
  return (
    <group position={[0, 0.98, zf]}>
      {([1, -1] as const).map((s) => <mesh key={s} position={[s * 0.055, -0.04, 0.02]} rotation={[0.2, 0, s * 0.42]}><boxGeometry args={[0.04, 0.2, 0.008]} /><M c={c} r={0.7} /></mesh>)}
      <mesh position={[0, -0.16, 0.05]} rotation={[Math.PI / 2 + 0.15, 0, 0]} castShadow><cylinderGeometry args={[0.062, 0.062, 0.016, 28]} /><M c={GOLD} m={0.95} r={0.2} /></mesh>
      <mesh position={[0, -0.16, 0.06]} rotation={[0.15, 0, 0]}><circleGeometry args={[0.04, 5]} /><M c="#F59E0B" m={0.8} r={0.3} /></mesh>
    </group>
  )
}

function Back({ kind, c, bw, flame, cape }: { kind: AvatarConfig['back']; c: string; bw: number; flame: React.RefObject<THREE.Group | null>; cape: React.RefObject<THREE.Mesh | null> }) {
  const capeGeo = useMemo(() => new THREE.LatheGeometry([[0.2, 1.05], [0.27, 0.9], [0.33, 0.6], [0.4, 0.3], [0.43, 0.2]].map(([r, y]) => new THREE.Vector2(r, y)), 28, Math.PI * 0.5, Math.PI), [])
  const zb = -0.2
  if (kind === 'none') return null
  if (kind === 'backpack') return (
    <group position={[0, 0.8, zb - 0.1]}>
      <RoundedBox args={[0.4 * bw, 0.46, 0.2]} radius={0.08} smoothness={5} castShadow><M c={c} r={0.75} /></RoundedBox>
      <RoundedBox args={[0.28 * bw, 0.18, 0.08]} radius={0.035} position={[0, -0.09, -0.11]} castShadow><M c={shade(c, -0.08)} r={0.75} /></RoundedBox>
      <mesh position={[0, 0.03, -0.155]}><boxGeometry args={[0.2, 0.012, 0.012]} /><M c="#C9CDD6" m={0.8} r={0.3} /></mesh>
      {([1, -1] as const).map((s) => <mesh key={s} position={[s * 0.15 * bw, 0.17, 0.17]} rotation={[0, Math.PI / 2, 0]} scale={[1.05, 1, 1]}><torusGeometry args={[0.165, 0.024, 8, 28, Math.PI]} /><M c={shade(c, -0.14)} r={0.8} /></mesh>)}
    </group>
  )
  if (kind === 'crossbody') return (
    <group>
      <mesh position={[0, 0.8, 0]} rotation={[Math.PI / 2, 0.62, 0]} scale={[bw, TORSO_Z, 1]}><torusGeometry args={[0.285, 0.016, 8, 48]} /><M c={shade(c, -0.14)} r={0.8} /></mesh>
      <RoundedBox args={[0.24, 0.17, 0.09]} radius={0.04} position={[-0.2 * bw, 0.6, 0.2]} rotation={[0, -0.5, 0]} castShadow><M c={c} r={0.7} /></RoundedBox>
      <mesh position={[-0.2 * bw + 0.035, 0.6, 0.262]} rotation={[0, -0.5, 0]}><boxGeometry args={[0.07, 0.014, 0.01]} /><M c={GOLD} m={0.9} r={0.25} /></mesh>
    </group>
  )
  if (kind === 'tote') return (
    <group position={[-(0.3 * bw + 0.06), 0.62, 0.02]}>
      <RoundedBox args={[0.1, 0.3, 0.32]} radius={0.03} castShadow><M c={c} r={0.9} cc={0} /></RoundedBox>
      <mesh position={[0, 0.28, 0]} rotation={[0, Math.PI / 2, 0]} scale={[0.6, 1.5, 1]}><torusGeometry args={[0.13, 0.013, 8, 24, Math.PI]} /><M c={shade(c, -0.14)} r={0.9} /></mesh>
      <mesh position={[-0.052, 0, 0]} rotation={[0, -Math.PI / 2, 0]}><circleGeometry args={[0.06, 24]} /><M c="#fff" r={0.8} /></mesh>
    </group>
  )
  if (kind === 'guitar') return (
    <group position={[0.02, 0.86, zb - 0.1]} rotation={[0, 0, -0.75]}>
      <Blob p={[0, -0.14, 0]} s={[0.21, 0.19, 0.05]} c={c} r={0.3} cc={0.9} />
      <Blob p={[0, 0.07, 0]} s={[0.15, 0.14, 0.05]} c={c} r={0.3} cc={0.9} />
      <mesh position={[0, -0.06, -0.052]} rotation={[0, Math.PI, 0]}><circleGeometry args={[0.055, 24]} /><M c="#1B1D2E" /></mesh>
      <mesh position={[0, 0.42, 0]}><boxGeometry args={[0.05, 0.5, 0.03]} /><M c="#5B3A24" r={0.6} /></mesh>
      <RoundedBox args={[0.09, 0.13, 0.035]} radius={0.015} position={[0, 0.72, 0]}><M c="#2A1A12" r={0.6} /></RoundedBox>
    </group>
  )
  if (kind === 'wings') return <>{([1, -1] as const).map((s) => (
    <group key={s} position={[s * 0.1, 0.92, zb - 0.05]} rotation={[0.1, s * -0.45, s * -0.25]}>
      {[0, 1, 2, 3].map((i) => <Blob key={i} p={[s * (0.2 + i * 0.07), 0.14 - i * 0.14, -0.02 * i]} s={[0.3 - i * 0.045, 0.09, 0.035]} rot={[0, 0, s * (0.5 - i * 0.28)]} c={i % 2 ? '#EAF1FF' : '#FFFFFF'} r={0.8} cc={0} />)}
    </group>
  ))}</>
  if (kind === 'cape') return (
    <group>
      <mesh ref={cape} geometry={capeGeo} scale={[bw * 1.02, 1, 1]} castShadow><M c={c} r={0.8} side={THREE.DoubleSide} /></mesh>
      <Blob p={[0, 1.03, 0.19]} s={0.035} c={GOLD} m={0.9} r={0.25} />
    </group>
  )
  // jetpack
  return (
    <group position={[0, 0.82, zb - 0.1]}>
      {([1, -1] as const).map((s) => <group key={s} position={[s * 0.12, 0, 0]}>
        <mesh castShadow><capsuleGeometry args={[0.095, 0.26, 8, 20]} /><M c={c} r={0.3} m={0.5} cc={0.8} /></mesh>
        <mesh position={[0, -0.25, 0]}><cylinderGeometry args={[0.06, 0.09, 0.08, 20]} /><M c="#3A3D4A" m={0.8} r={0.35} /></mesh>
        <mesh position={[0, 0.06, -0.085]}><boxGeometry args={[0.06, 0.03, 0.02]} /><M c={GOLD} e={GOLD} /></mesh>
      </group>)}
      <RoundedBox args={[0.2, 0.2, 0.1]} radius={0.03} position={[0, 0.02, 0.06]}><M c="#3A3D4A" m={0.6} r={0.4} /></RoundedBox>
      <group ref={flame}>{([1, -1] as const).map((s) => <group key={s} position={[s * 0.12, -0.4, 0]} rotation={[Math.PI, 0, 0]}>
        <mesh><coneGeometry args={[0.065, 0.26, 16]} /><M c="#FF7A1A" e="#FF7A1A" o={0.9} /></mesh>
        <mesh position={[0, -0.04, 0]}><coneGeometry args={[0.035, 0.16, 12]} /><M c="#FFE9A3" e="#FFE9A3" /></mesh>
      </group>)}</group>
    </group>
  )
}

/** Əldə tutulan əşya (əl qrupunun içində; qol irəli uzanıb — əşya dik qalsın deyə əks fırlanma verilir). */
function HandItem({ kind, cfg }: { kind: AvatarConfig['hand']; cfg: AvatarConfig }) {
  if (kind === 'none') return null
  return (
    <group position={[0, -0.43, 0.02]} rotation={[1.15, 0, 0]}>
      {kind === 'book' && <group position={[0, 0.06, 0.06]} rotation={[0.2, 0.3, 0]}>
        <RoundedBox args={[0.21, 0.28, 0.06]} radius={0.012} castShadow><M c="#3B82F6" r={0.6} /></RoundedBox>
        <mesh position={[0.008, 0, 0]}><boxGeometry args={[0.2, 0.262, 0.045]} /><M c="#F5F5F7" r={0.9} /></mesh>
        <mesh position={[0, 0.03, 0.032]}><boxGeometry args={[0.12, 0.05, 0.004]} /><M c={GOLD} /></mesh>
      </group>}
      {kind === 'trophy' && <group position={[0, 0.02, 0.03]}>
        <mesh position={[0, 0.24, 0]} castShadow><cylinderGeometry args={[0.105, 0.045, 0.17, 28]} /><M c={GOLD} m={0.95} r={0.2} /></mesh>
        {([1, -1] as const).map((s) => <mesh key={s} position={[s * 0.11, 0.25, 0]} rotation={[0, 0, s * -0.2]}><torusGeometry args={[0.045, 0.012, 8, 20]} /><M c={GOLD} m={0.95} r={0.2} /></mesh>)}
        <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.018, 0.018, 0.1, 12]} /><M c={GOLD} m={0.95} r={0.2} /></mesh>
        <mesh position={[0, 0.05, 0]} castShadow><cylinderGeometry args={[0.06, 0.07, 0.05, 24]} /><M c="#2A1A12" r={0.5} /></mesh>
      </group>}
      {kind === 'mic' && <group rotation={[0.2, 0, -0.15]} position={[0, 0.02, 0.03]}>
        <mesh position={[0, 0.07, 0]} castShadow><cylinderGeometry args={[0.024, 0.02, 0.2, 14]} /><M c="#1B1D2E" r={0.4} /></mesh>
        <Blob p={[0, 0.2, 0]} s={0.052} c="#C9CDD6" m={0.8} r={0.45} />
        <mesh position={[0, 0.165, 0]}><cylinderGeometry args={[0.03, 0.026, 0.02, 14]} /><M c={cfg.topColor2} /></mesh>
      </group>}
      {kind === 'balloon' && <group position={[0, 0, 0.03]}>
        <mesh position={[0, 0.34, 0]}><cylinderGeometry args={[0.004, 0.004, 0.68, 5]} /><M c="#F5F5F7" /></mesh>
        <Blob p={[0, 0.84, 0]} s={[0.18, 0.21, 0.18]} c="#F0262F" r={0.2} cc={1} />
        <mesh position={[0, 0.63, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.03, 0.04, 10]} /><M c="#F0262F" /></mesh>
      </group>}
      {kind === 'phone' && <group position={[0, 0.07, 0.05]} rotation={[-0.25, 0.35, 0]}>
        <RoundedBox args={[0.12, 0.23, 0.018]} radius={0.016} castShadow><M c="#1B1D2E" r={0.3} cc={0.9} /></RoundedBox>
        <mesh position={[0, 0, 0.0095]}><planeGeometry args={[0.104, 0.21]} /><M c="#6366F1" e="#4F52D9" r={0.2} /></mesh>
      </group>}
      {kind === 'icecream' && <group position={[0, 0.02, 0.03]}>
        <mesh position={[0, 0.07, 0]} rotation={[Math.PI, 0, 0]} castShadow><coneGeometry args={[0.055, 0.19, 18]} /><M c="#D9A45B" r={0.85} /></mesh>
        <Blob p={[0, 0.185, 0]} s={0.068} c="#FF9EC0" r={0.5} />
        <Blob p={[0.02, 0.26, 0]} s={0.052} c="#FFF3D6" r={0.5} />
        <Blob p={[0.03, 0.31, 0.01]} s={0.02} c="#F0262F" r={0.3} cc={1} />
      </group>}
    </group>
  )
}

// ───────────────────────── PERSONAJ ─────────────────────────
/**
 * @param interactive baş göstəricini izləyir
 * @param still animasiya yoxdur (kiçik şəkillər üçün sabit kadr)
 */
export function Character({ cfg, interactive = false, still = false }: { cfg: AvatarConfig; interactive?: boolean; still?: boolean }) {
  const root = useRef<THREE.Group>(null), body = useRef<THREE.Group>(null), head = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null), armL = useRef<THREE.Group>(null), flame = useRef<THREE.Group>(null), cape = useRef<THREE.Mesh>(null)
  const bw = BUILD[cfg.build as keyof typeof BUILD] ?? 1
  const torsoGeo = useTorsoGeo()
  const tKey = [cfg.top, cfg.topColor, cfg.topColor2, cfg.pattern, cfg.number, cfg.bottom, cfg.bottomColor, cfg.skin].join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const torsoMap = useMemo(() => paintTorso(cfg), [tKey])
  useEffect(() => () => torsoMap.dispose(), [torsoMap])
  const holding = cfg.hand !== 'none'
  const hatOn = covers(cfg.hat), top = hairTop(cfg.hat === 'none' || !hatOn ? cfg.hair : 'bald')
  const shoulderX = 0.262 * bw + 0.012
  const pose = useRef({ rz: 0.2, lz: 0.2, rx: 0, lx: 0 })

  useFrame(({ clock, pointer }, dt) => {
    const t = still ? 0.9 : clock.elapsedTime, k = still ? 1 : 1 - Math.exp(-dt * 9)
    const p = cfg.pose
    let bob = Math.sin(t * 1.7) * 0.008, sway = 0, rz = 0.2 + Math.sin(t * 1.7) * 0.03, lz = 0.2 + Math.sin(t * 1.7 + 0.6) * 0.03, rx = Math.sin(t * 1.7) * 0.05, lx = -Math.sin(t * 1.7) * 0.05, tilt = Math.sin(t * 0.9) * 0.035
    if (p === 'wave') { lz = 2.3 + Math.sin(t * 6) * 0.28; lx = -0.15; tilt = 0.09 }
    if (p === 'cheer') { rz = 2.15 + Math.sin(t * 5) * 0.12; lz = 2.15 + Math.sin(t * 5 + 0.5) * 0.12; bob = Math.abs(Math.sin(t * 5)) * 0.06; rx = lx = 0 }
    if (p === 'dance') { sway = Math.sin(t * 3.4) * 0.1; bob = Math.abs(Math.sin(t * 3.4)) * 0.045; rz = 1.25 + Math.sin(t * 3.4) * 0.75; lz = 1.25 - Math.sin(t * 3.4) * 0.75; rx = lx = -0.2; tilt = -sway * 0.8 }
    if (holding) { rz = 0.12; rx = -1.15 + Math.sin(t * 1.7) * 0.03 }
    const q = pose.current
    q.rz += (rz - q.rz) * k; q.lz += (lz - q.lz) * k; q.rx += (rx - q.rx) * k; q.lx += (lx - q.lx) * k
    if (armR.current) armR.current.rotation.set(q.rx, 0, q.rz)
    if (armL.current) armL.current.rotation.set(q.lx, 0, -q.lz)
    if (body.current) { body.current.position.y = bob; body.current.rotation.z = sway }
    if (head.current) {
      const ty = interactive && !still ? pointer.x * 0.42 : 0, tx = interactive && !still ? -pointer.y * 0.22 : 0
      head.current.rotation.y += (ty - head.current.rotation.y) * k * 0.6
      head.current.rotation.x += (tx - head.current.rotation.x) * k * 0.6
      head.current.rotation.z = tilt
    }
    if (flame.current) flame.current.scale.y = 0.85 + Math.sin(t * 22) * 0.18
    if (cape.current) cape.current.rotation.x = 0.05 + Math.sin(t * 1.6) * 0.03
  })

  return (
    <group ref={root}>
      <Legs cfg={cfg} bw={bw} />
      <group ref={body}>
        {/* gövdə */}
        <mesh geometry={torsoGeo} scale={[bw, 1, TORSO_Z]} castShadow receiveShadow><M map={torsoMap} r={0.68} /></mesh>
        {cfg.top === 'hoodie' && <Blob p={[0, 1.03, -0.17]} s={[0.25 * bw, 0.12, 0.13]} rot={[-0.5, 0, 0]} c={shade(cfg.topColor, -0.05)} r={0.8} />}
        {cfg.top === 'jacket' && <mesh position={[0, 1.06, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.9, 1]}><torusGeometry args={[0.15, 0.04, 10, 32]} /><M c={cfg.topColor2} r={0.9} /></mesh>}
        {cfg.top === 'sweater' && <mesh position={[0, 1.065, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.9, 1]}><torusGeometry args={[0.145, 0.05, 12, 32]} /><M c={shade(cfg.topColor, -0.06)} r={0.95} cc={0} /></mesh>}
        <Neck kind={cfg.neck} c={cfg.neckColor} zf={torsoR(0.99) * TORSO_Z} />
        <Back kind={cfg.back} c={cfg.backColor} bw={bw} flame={flame} cape={cape} />
        {/* qollar */}
        <group position={[shoulderX, 1.0, 0]}><Arm side={1} cfg={cfg} refArm={armR}><HandItem kind={cfg.hand} cfg={cfg} /></Arm></group>
        <group position={[-shoulderX, 1.0, 0]}><Arm side={-1} cfg={cfg} refArm={armL} /></group>
        {/* baş */}
        <group position={[0, HEAD_Y, 0]} ref={head}>
          <group scale={[1, 0.93, 0.95]}>
            <mesh castShadow><sphereGeometry args={[0.5, 64, 48]} /><M c={cfg.skin} r={0.6} /></mesh>
            {([1, -1] as const).map((s) => <Blob key={s} p={[s * 0.492, -0.045, 0]} s={[0.05, 0.085, 0.07]} c={cfg.skin} r={0.6} />)}
            <Blob p={[0, -0.085, 0.497]} s={[0.036, 0.03, 0.03]} c={shade(cfg.skin, -0.05)} r={0.6} />
            <Face cfg={cfg} still={still} />
            <Glasses kind={cfg.glasses} color={cfg.glassesColor} />
            <HairStyle kind={cfg.hair} c={cfg.hairColor} hat={hatOn} />
            {hatOn ? <Hat kind={cfg.hat} c={cfg.hatColor} /> : <HeadTopper kind={cfg.hat} c={cfg.hatColor} top={top} />}
          </group>
        </group>
      </group>
    </group>
  )
}
