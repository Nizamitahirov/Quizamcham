/**
 * Prosedur 3D personaj (yalnız primitivlərdən): "oyuncaq" üslubu, yumşaq materiallar.
 * Koordinatlar: ayaq y=0, baş mərkəzi y≈1.98, üz +z istiqamətində.
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import type { AvatarConfig } from '../../lib/avatar3d'

const HEAD_Y = 1.98, HEAD_R = 0.4
const BUILD = { slim: 0.88, regular: 1, broad: 1.16 } as const
const GOLD = '#FFC531'

function shade(hex: string, k: number) {
  const c = new THREE.Color(hex); const h = { h: 0, s: 0, l: 0 }; c.getHSL(h)
  return new THREE.Color().setHSL(h.h, h.s, Math.max(0, Math.min(1, h.l + k))).getStyle()
}
/** Parça toxuması üçün prosedur bump xəritəsi (bir dəfə yaradılır). */
let weave: THREE.CanvasTexture | null = null
function weaveTex() {
  if (weave || typeof document === 'undefined') return weave
  const cv = document.createElement('canvas'); cv.width = cv.height = 64
  const g = cv.getContext('2d')!
  g.fillStyle = '#808080'; g.fillRect(0, 0, 64, 64)
  for (let y = 0; y < 64; y += 4) for (let x = 0; x < 64; x += 4) {
    const v = ((x + y) / 4) % 2 ? 150 : 105
    g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 4, 2); g.fillStyle = `rgb(${255 - v},${255 - v},${255 - v})`; g.fillRect(x, y + 2, 4, 2)
  }
  weave = new THREE.CanvasTexture(cv); weave.wrapS = weave.wrapT = THREE.RepeatWrapping; weave.repeat.set(10, 10)
  return weave
}
let strands: THREE.CanvasTexture | null = null
function strandTex() {
  if (strands || typeof document === 'undefined') return strands
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 16
  const g = cv.getContext('2d')!
  for (let x = 0; x < 128; x++) { const v = 110 + Math.floor(Math.random() * 90); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, 16) }
  strands = new THREE.CanvasTexture(cv); strands.wrapS = strands.wrapT = THREE.RepeatWrapping; strands.repeat.set(3, 1)
  return strands
}
/** Saç: tel-tel bump, məxməri parıltı. */
const HairMat = ({ c, o }: { c: string; o?: number }) => (
  <meshPhysicalMaterial color={c} roughness={0.55} sheen={0.9} sheenRoughness={0.35} sheenColor={shade(c, 0.35)} bumpMap={strandTex()} bumpScale={1.2}
    transparent={o != null} opacity={o ?? 1} clearcoat={0.15} clearcoatRoughness={0.5} />
)
/**
 * Fiziki material: parça/saç üçün "sheen" (məxməri parıltı) və toxuma, metal üçün clearcoat.
 * r ≥ 0.7 və metal deyil → parça kimi işlənir.
 */
const Mat = ({ c, r = 0.75, m = 0, e, o, side, cc, flat }: { c: string; r?: number; m?: number; e?: string; o?: number; side?: THREE.Side; cc?: number; flat?: boolean }) => {
  const fabric = !flat && r >= 0.7 && m < 0.3 && !e && o == null
  return (
    <meshPhysicalMaterial color={c} roughness={r} metalness={m} emissive={e ?? '#000'} emissiveIntensity={e ? 0.9 : 0} transparent={o != null} opacity={o ?? 1} side={side}
      sheen={fabric ? 0.6 : 0} sheenRoughness={0.55} sheenColor={fabric ? shade(c, 0.25) : '#000'} bumpMap={fabric ? weaveTex() : null} bumpScale={fabric ? 0.6 : 0}
      clearcoat={cc ?? (m > 0.5 ? 0.6 : 0)} clearcoatRoughness={0.25} envMapIntensity={1} />
  )
}
/** Dəri: yumşaq "subsurface" təəssüratı — isti sheen və bir az emissiv. */
const Skin = ({ c }: { c: string }) => (
  <meshPhysicalMaterial color={c} roughness={0.52} metalness={0} sheen={0.35} sheenRoughness={0.7} sheenColor={shade(c, 0.12)} emissive={shade(c, -0.35)} emissiveIntensity={0.08} clearcoat={0.04} clearcoatRoughness={0.6} />
)
/** Başın səthində nöqtə (üz elementləri üçün). */
const onFace = (x: number, y: number, lift = 0.006): [number, number, number] => {
  const dy = (y - HEAD_Y) / 0.95
  const z = Math.sqrt(Math.max(0, HEAD_R * HEAD_R - x * x - dy * dy)) * 0.95
  return [x, y, z + lift]
}
const faceRot = (x: number): [number, number, number] => [0, Math.atan2(x, 0.36), 0]

function starShape(r1: number, r2: number) {
  const s = new THREE.Shape()
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? r2 : r1; const p = [Math.cos(a) * r, Math.sin(a) * r] as const; if (i) s.lineTo(p[0], p[1]); else s.moveTo(p[0], p[1]) }
  s.closePath(); return s
}
function heartShape(k: number) {
  const s = new THREE.Shape(); s.moveTo(0, -0.6 * k)
  s.bezierCurveTo(-1.1 * k, 0.05 * k, -0.6 * k, 0.9 * k, 0, 0.4 * k)
  s.bezierCurveTo(0.6 * k, 0.9 * k, 1.1 * k, 0.05 * k, 0, -0.6 * k)
  return s
}

// ---------- üz ----------
function Eye({ x, kind, color, side, skin }: { x: number; kind: AvatarConfig['eyes']; color: string; side: 1 | -1; skin: string }) {
  const y = 2.0, p = onFace(x, y), rot = faceRot(x)
  const star = useMemo(() => new THREE.ExtrudeGeometry(starShape(0.07, 0.03), { depth: 0.01, bevelEnabled: false }), [])
  const lid = useRef<THREE.Group>(null), iris = useRef<THREE.Group>(null)
  const k = kind === 'wink' && side === 1 ? 'happy' : kind
  // göz qırpma (hər ~4 san) + bəbəklərin incə hərəkəti
  useFrame(({ clock, pointer }) => {
    const t = clock.elapsedTime
    if (lid.current) {
      const ph = (t + 0.3) % 4.2
      const close = ph < 0.16 ? Math.sin((ph / 0.16) * Math.PI) : 0
      const base = k === 'angry' ? 0.42 : 0.12
      lid.current.scale.y = base + (1 - base) * close
    }
    if (iris.current) { iris.current.position.x = THREE.MathUtils.clamp(pointer.x * 0.012, -0.012, 0.012); iris.current.position.y = THREE.MathUtils.clamp(pointer.y * 0.008, -0.008, 0.008) }
  })
  if (k === 'happy') return <mesh position={[p[0], p[1] - 0.01, p[2]]} rotation={rot}><torusGeometry args={[0.05, 0.015, 8, 20, Math.PI]} /><Mat c="#1B1210" r={0.4} /></mesh>
  if (k === 'sleepy') return <mesh position={p} rotation={[rot[0], rot[1], 0]}><torusGeometry args={[0.05, 0.014, 8, 20, Math.PI]} /><Mat c="#1B1210" r={0.4} /></mesh>
  if (k === 'star') return <mesh geometry={star} position={[p[0], p[1], p[2] - 0.004]} rotation={rot}><Mat c={GOLD} r={0.3} e="#7A5200" /></mesh>
  const big = k === 'sparkle' ? 1.3 : 1
  return (
    <group position={p} rotation={rot}>
      {/* göz alması (yaş parıltı — clearcoat) */}
      <mesh scale={[1, 1.15, 0.45]}><sphereGeometry args={[0.058 * big, 24, 18]} /><meshPhysicalMaterial color="#FBFBFD" roughness={0.18} clearcoat={1} clearcoatRoughness={0.08} /></mesh>
      <group ref={iris}>
        <mesh position={[0, -0.004, 0.018]} scale={[1, 1.1, 0.4]}><sphereGeometry args={[0.042 * big, 24, 18]} /><meshPhysicalMaterial color={color} roughness={0.25} clearcoat={1} clearcoatRoughness={0.05} /></mesh>
        <mesh position={[0, -0.004, 0.024]} scale={[1, 1.1, 0.4]}><torusGeometry args={[0.036 * big, 0.004, 6, 24]} /><meshBasicMaterial color={shade(color, -0.25)} /></mesh>
        <mesh position={[0, -0.004, 0.028]} scale={[1, 1.1, 0.4]}><sphereGeometry args={[0.022 * big, 16, 12]} /><meshPhysicalMaterial color="#07070A" roughness={0.1} clearcoat={1} /></mesh>
        <mesh position={[0.016 * big, 0.02 * big, 0.036]}><sphereGeometry args={[0.011 * big, 10, 8]} /><meshBasicMaterial color="#FFFFFF" /></mesh>
        <mesh position={[-0.012 * big, -0.018 * big, 0.034]}><sphereGeometry args={[0.005 * big, 8, 6]} /><meshBasicMaterial color="#FFFFFF" /></mesh>
      </group>
      {k === 'sparkle' && <mesh position={[-0.02, -0.025, 0.036]}><sphereGeometry args={[0.007, 8, 6]} /><meshBasicMaterial color="#FFFFFF" /></mesh>}
      {/* üst göz qapağı: qırpanda aşağı enir */}
      <group ref={lid} position={[0, 0.07 * big, 0.004]} scale={[1, 0.12, 1]}>
        <mesh position={[0, -0.07 * big, 0]} scale={[1.1, 1.22, 0.54]}><sphereGeometry args={[0.058 * big, 24, 16]} /><Skin c={shade(skin, -0.02)} /></mesh>
      </group>
      {k === 'lashes' && [-0.5, 0, 0.5].map((a, i) => <mesh key={i} position={[side * 0.03 + a * 0.03, 0.07, 0]} rotation={[0, 0, a * -0.6 - side * 0.4]}><boxGeometry args={[0.008, 0.035, 0.008]} /><Mat c="#1B1210" flat /></mesh>)}
    </group>
  )
}

function Brows({ kind, color }: { kind: AvatarConfig['brows']; color: string }) {
  if (kind === 'none') return null
  const c = shade(color, -0.08)
  return (
    <>
      {([-1, 1] as const).map((s) => {
        const x = s * 0.14
        let y = 2.11, z = 0, thick = 0.022
        if (kind === 'thick') thick = 0.038
        if (kind === 'raised' && s === 1) y = 2.15
        if (kind === 'angry') z = s * 0.35
        if (kind === 'worried') z = -s * 0.3
        if (kind === 'soft') z = -s * 0.08
        const p = onFace(x, y, 0.012)
        return <mesh key={s} position={p} rotation={[0, faceRot(x)[1], z]}><boxGeometry args={[0.12, thick, 0.02]} /><Mat c={c} /></mesh>
      })}
    </>
  )
}

function Mouth({ kind }: { kind: AvatarConfig['mouth'] }) {
  const y = 1.82, p = onFace(0, y, 0.004)
  const dark = '#3A1414', pink = '#F27A8C'
  switch (kind) {
    case 'grin': return (
      <group position={p}>
        <mesh rotation={[0, 0, Math.PI]}><circleGeometry args={[0.085, 24, 0, Math.PI]} /><Mat c={dark} side={THREE.DoubleSide} /></mesh>
        <mesh position={[0, -0.018, 0.002]}><boxGeometry args={[0.13, 0.028, 0.004]} /><Mat c="#FFFFFF" r={0.3} /></mesh>
      </group>)
    case 'open': return (
      <group position={p}>
        <mesh scale={[1, 0.8, 0.3]}><sphereGeometry args={[0.06, 20, 14]} /><Mat c={dark} /></mesh>
        <mesh position={[0, -0.025, 0.012]} scale={[1, 0.6, 0.3]}><sphereGeometry args={[0.035, 16, 10]} /><Mat c={pink} /></mesh>
      </group>)
    case 'o': return <mesh position={p}><torusGeometry args={[0.03, 0.013, 8, 20]} /><Mat c={dark} /></mesh>
    case 'neutral': return <mesh position={p} rotation={[0, 0, Math.PI / 2]}><capsuleGeometry args={[0.011, 0.08, 4, 8]} /><Mat c={dark} /></mesh>
    case 'smirk': return <mesh position={[p[0] + 0.02, p[1] + 0.008, p[2]]} rotation={[0, 0, Math.PI + 0.35]}><torusGeometry args={[0.055, 0.013, 8, 20, Math.PI * 0.75]} /><Mat c={dark} /></mesh>
    case 'tongue': return (
      <group position={p}>
        <mesh rotation={[0, 0, Math.PI]}><torusGeometry args={[0.065, 0.014, 8, 20, Math.PI]} /><Mat c={dark} /></mesh>
        <mesh position={[0.015, -0.06, 0.008]} scale={[1, 1.2, 0.5]}><sphereGeometry args={[0.03, 16, 10]} /><Mat c={pink} /></mesh>
      </group>)
    case 'cat': return (
      <group position={p}>
        {[-1, 1].map((s) => <mesh key={s} position={[s * 0.028, 0, 0]} rotation={[0, 0, Math.PI]}><torusGeometry args={[0.028, 0.011, 8, 16, Math.PI]} /><Mat c={dark} /></mesh>)}
      </group>)
    default: return <mesh position={p} rotation={[0, 0, Math.PI]}><torusGeometry args={[0.07, 0.015, 8, 24, Math.PI]} /><Mat c={dark} /></mesh>
  }
}

function Glasses({ kind, color }: { kind: AvatarConfig['glasses']; color: string }) {
  const y = 2.0
  const heart = useMemo(() => new THREE.ExtrudeGeometry(heartShape(0.075), { depth: 0.01, bevelEnabled: false }), [])
  if (kind === 'none') return null
  if (kind === 'visor') return (
    <mesh position={[0, y, 0.02]} rotation={[0, 0, 0]}>
      <cylinderGeometry args={[0.43, 0.43, 0.13, 32, 1, true, -Math.PI * 0.32, Math.PI * 0.64]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} transparent opacity={0.85} side={THREE.DoubleSide} roughness={0.2} metalness={0.3} />
    </mesh>
  )
  if (kind === 'monocle') { const p = onFace(0.14, y, 0.055); return (
    <group position={p} rotation={faceRot(0.14)}>
      <mesh><torusGeometry args={[0.075, 0.01, 8, 28]} /><Mat c={GOLD} r={0.3} m={0.7} /></mesh>
      <mesh><circleGeometry args={[0.07, 24]} /><meshStandardMaterial color="#BFE3FF" transparent opacity={0.25} /></mesh>
      <mesh position={[0.06, -0.14, -0.02]} rotation={[0, 0, 0.3]}><cylinderGeometry args={[0.004, 0.004, 0.22]} /><Mat c={GOLD} m={0.7} r={0.3} /></mesh>
    </group>) }
  return (
    <group>
      {([-1, 1] as const).map((s) => {
        const p = onFace(s * 0.14, y, 0.055), r = faceRot(s * 0.14)
        if (kind === 'heart') return <group key={s} position={p} rotation={r}><mesh geometry={heart} position={[0, 0, -0.005]}><meshStandardMaterial color={color} transparent opacity={0.75} roughness={0.2} /></mesh></group>
        if (kind === 'square') return (
          <group key={s} position={p} rotation={r}>
            <mesh position={[0, 0.06, 0]}><boxGeometry args={[0.17, 0.018, 0.018]} /><Mat c={color} r={0.4} /></mesh>
            <mesh position={[0, -0.06, 0]}><boxGeometry args={[0.17, 0.018, 0.018]} /><Mat c={color} r={0.4} /></mesh>
            <mesh position={[-0.076, 0, 0]}><boxGeometry args={[0.018, 0.13, 0.018]} /><Mat c={color} r={0.4} /></mesh>
            <mesh position={[0.076, 0, 0]}><boxGeometry args={[0.018, 0.13, 0.018]} /><Mat c={color} r={0.4} /></mesh>
          </group>)
        return (
          <group key={s} position={p} rotation={r}>
            <mesh><torusGeometry args={[0.078, 0.013, 8, 28]} /><Mat c={color} r={0.35} m={0.2} /></mesh>
            {kind === 'sun' && <mesh scale={[1, 0.85, 1]}><circleGeometry args={[0.075, 28]} /><meshStandardMaterial color="#0E0F18" transparent opacity={0.92} roughness={0.1} metalness={0.4} /></mesh>}
          </group>)
      })}
      <mesh position={onFace(0, y + 0.01, 0.06)}><boxGeometry args={[0.07, 0.015, 0.015]} /><Mat c={color} /></mesh>
      {([-1, 1] as const).map((s) => <mesh key={`a${s}`} position={[s * 0.4, y + 0.01, 0.1]} rotation={[0, s * 0.25, 0]}><boxGeometry args={[0.012, 0.012, 0.18]} /><Mat c={color} /></mesh>)}
    </group>
  )
}

function FacialHair({ kind, color }: { kind: AvatarConfig['facial']; color: string }) {
  if (kind === 'none') return null
  const c = shade(color, -0.04)
  const mustache = <group>{([-1, 1] as const).map((s) => <mesh key={s} position={onFace(s * 0.046, 1.872, 0.012)} rotation={[0, s * 0.25, s * -0.32]} scale={[1.05, 0.42, 0.55]}><sphereGeometry args={[0.056, 18, 12]} /><HairMat c={c} /></mesh>)}</group>
  if (kind === 'mustache') return mustache
  if (kind === 'goatee') return <group>{mustache}<mesh position={onFace(0, 1.735, -0.03)} scale={[0.9, 1.25, 0.8]}><sphereGeometry args={[0.062, 18, 14]} /><HairMat c={c} /></mesh></group>
  const beard = kind === 'beard'
  // çənə forması ilə eyni mərkəz — saqqal üzü "maska" kimi örtmür, çənəni qucaqlayır
  return (
    <group position={[0, HEAD_Y - 0.17, 0.07]}>
      <mesh scale={[0.86, 0.66, 0.82]}><sphereGeometry args={[beard ? 0.322 : 0.304, 40, 24, 0, Math.PI * 2, 1.5, Math.PI - 1.5]} />{beard ? <HairMat c={c} /> : <HairMat c={c} o={0.42} />}</mesh>
      {([-1, 1] as const).map((s) => <mesh key={s} position={[s * 0.255, 0.12, -0.09]} scale={[0.35, 1, 0.6]}><capsuleGeometry args={[beard ? 0.06 : 0.05, 0.12, 6, 10]} />{beard ? <HairMat c={c} /> : <HairMat c={c} o={0.42} />}</mesh>)}
      {beard && <><mesh position={[0, -0.17, 0.12]} scale={[1.15, 0.9, 0.8]}><sphereGeometry args={[0.11, 20, 14]} /><HairMat c={c} /></mesh>{mustache && <group position={[0, -(HEAD_Y - 0.17), -0.07]}>{mustache}</group>}</>}
    </group>
  )
}

// ---------- saç ----------
function Hair({ kind, color, hat }: { kind: AvatarConfig['hair']; color: string; hat: boolean }) {
  const c = color, top = !hat
  const curls = useMemo(() => {
    const pts: [number, number, number][] = []
    const n = 34
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 1.1, r = Math.sqrt(Math.max(0, 1 - y * y)), a = i * 2.39996
      if (y < 0.1) continue
      const x = Math.cos(a) * r, z = Math.sin(a) * r
      if (z > 0.55 && y < 0.55) continue
      pts.push([x * 0.42, y * 0.42, z * 0.42])
    }
    return pts
  }, [])
  if (kind === 'bald') return null
  // papaq varsa saç onun altında qalır (bir az kiçik qapaq, kəkil yox)
  const cap = (rad = 0.425, theta = 1.28, tilt = -0.32, o?: number) => (
    <mesh rotation={[tilt, 0, 0]} castShadow><sphereGeometry args={[hat ? Math.min(rad, 0.412) : rad, 48, 24, 0, Math.PI * 2, 0, theta]} /><HairMat c={c} o={o} /></mesh>
  )
  /** Alına düşən kəkil: başı qucaqlayan sferik zolaq (öndə). shift — yan ayırma üçün sürüşmə. */
  const fringe = (shift = 0, depth = 0.9) => !hat && (
    <group rotation={[0, shift, 0]}>
      <mesh rotation={[-0.08, 0, 0]}><sphereGeometry args={[0.432, 40, 16, Math.PI / 2 - 0.95, 1.9, 0.18, depth]} /><HairMat c={c} /></mesh>
    </group>
  )
  return (
    <group position={[0, HEAD_Y, 0]}>
      {kind === 'buzz' ? cap(0.408, 1.25, -0.3, 0.9) : cap()}
      {kind === 'short' && fringe(0, 0.82)}
      {kind === 'sidepart' && <>{fringe(-0.25, 0.86)}{!hat && <mesh position={[0.1, 0.3, 0.22]} rotation={[0.7, 0.3, -0.5]} scale={[0.32, 0.075, 0.14]}><sphereGeometry args={[1, 24, 12]} /><HairMat c={c} /></mesh>}</>}
      {kind === 'curly' && curls.map((p, i) => <mesh key={i} position={[p[0], p[1] + 0.02, p[2] - 0.02]}><sphereGeometry args={[0.085, 12, 10]} /><HairMat c={c} /></mesh>)}
      {kind === 'afro' && <mesh position={[0, hat ? 0.05 : 0.14, -0.14]} scale={hat ? [1.05, 0.8, 0.8] : [1.25, 1.08, 0.9]}><sphereGeometry args={[0.52, 32, 24]} /><HairMat c={c} /></mesh>}
      {kind === 'bun' && top && <><mesh position={[0, 0.47, -0.06]}><sphereGeometry args={[0.16, 20, 16]} /><HairMat c={c} /></mesh><mesh position={[0, 0.36, -0.04]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.1, 0.025, 8, 20]} /><Mat c={shade(c, -0.15)} /></mesh></>}
      {kind === 'ponytail' && <>
        <mesh position={[0, 0.02, -0.45]} rotation={[0.45, 0, 0]}><capsuleGeometry args={[0.1, 0.42, 6, 14]} /><HairMat c={c} /></mesh>
        <mesh position={[0, 0.2, -0.4]} rotation={[1.1, 0, 0]}><torusGeometry args={[0.08, 0.025, 8, 18]} /><Mat c="#F0262F" /></mesh>
      </>}
      {(kind === 'long' || kind === 'wavy') && <>
        <mesh position={[0, -0.25, -0.13]} scale={[1.07, 1.55, 0.62]} castShadow><sphereGeometry args={[0.42, 36, 24]} /><HairMat c={c} /></mesh>
        {([-1, 1] as const).map((s) => <mesh key={s} position={[s * 0.35, -0.24, 0.0]} rotation={[0.05, 0, s * 0.05]} scale={[0.85, 1, 0.6]}><capsuleGeometry args={[0.11, 0.46, 8, 16]} /><HairMat c={c} /></mesh>)}
        {fringe(0.15, 0.7)}
        {kind === 'wavy' && ([-1, 1] as const).flatMap((s) => [0, 1, 2].map((i) => <mesh key={`${s}${i}`} position={[s * (0.41 + (i % 2) * 0.03), -0.05 - i * 0.17, 0.08]}><sphereGeometry args={[0.07, 12, 10]} /><HairMat c={c} /></mesh>))}
      </>}
      {kind === 'bob' && <>
        {/* çənəyə qədər "dəbilqə" — üz açıq qalır */}
        <mesh scale={[1.04, 1, 1]}><sphereGeometry args={[0.445, 48, 28, Math.PI / 2 + 0.78, Math.PI * 2 - 1.56, 0.2, 1.75]} /><HairMat c={c} /></mesh>
        {fringe(0, 0.95)}
      </>}
      {kind === 'mohawk' && top && [0, 1, 2, 3, 4, 5].map((i) => { const a = -0.55 + i * 0.36; return <mesh key={i} position={[0, Math.cos(a) * 0.43, Math.sin(a) * 0.43]} rotation={[a, 0, 0]}><coneGeometry args={[0.075, 0.26, 10]} /><HairMat c={c} /></mesh> })}
      {kind === 'spiky' && top && Array.from({ length: 11 }, (_, i) => { const a = (i / 11) * Math.PI * 2, tilt = 0.75; const dir = new THREE.Vector3(Math.cos(a) * Math.sin(tilt), Math.cos(tilt), Math.sin(a) * Math.sin(tilt) - 0.15).normalize(); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); return <mesh key={i} position={dir.clone().multiplyScalar(0.4).toArray()} quaternion={q}><coneGeometry args={[0.08, 0.24, 10]} /><HairMat c={c} /></mesh> })}
      {kind === 'spiky' && top && <mesh position={[0, 0.47, 0]}><coneGeometry args={[0.08, 0.24, 10]} /><HairMat c={c} /></mesh>}
      {kind === 'pigtails' && ([-1, 1] as const).map((s) => <group key={s}>
        <mesh position={[s * 0.5, -0.05, -0.05]}><sphereGeometry args={[0.15, 18, 14]} /><HairMat c={c} /></mesh>
        <mesh position={[s * 0.4, 0.02, -0.04]} rotation={[0, 0, Math.PI / 2]}><torusGeometry args={[0.06, 0.022, 8, 16]} /><Mat c="#EC4899" /></mesh>
      </group>)}
    </group>
  )
}

// ---------- papaqlar ----------
function Hat({ kind, color }: { kind: AvatarConfig['hat']; color: string }) {
  if (kind === 'none') return null
  const c = color, y = HEAD_Y
  switch (kind) {
    case 'cap': case 'backcap': { const f = kind === 'cap' ? 1 : -1; return (
      <group position={[0, y + 0.04, 0]}>
        <mesh rotation={[-0.15, 0, 0]} scale={[1, 0.82, 1]}><sphereGeometry args={[0.445, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /><Mat c={c} /></mesh>
        <mesh position={[0, 0.06, f * 0.42]} rotation={[f * 0.12, 0, 0]} scale={[1, 1, 1.25]}><cylinderGeometry args={[0.27, 0.27, 0.03, 28, 1, false, f === 1 ? -Math.PI / 2 : Math.PI / 2, Math.PI]} /><Mat c={shade(c, -0.08)} /></mesh>
        <mesh position={[0, 0.37, -0.06]}><sphereGeometry args={[0.035, 10, 8]} /><Mat c={shade(c, -0.1)} /></mesh>
      </group>) }
    case 'beanie': return (
      <group position={[0, y + 0.03, 0]}>
        <mesh scale={[1, 1.02, 1]}><sphereGeometry args={[0.45, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.56]} /><Mat c={c} r={0.95} /></mesh>
        <mesh position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.43, 0.075, 12, 40]} /><Mat c={shade(c, -0.06)} r={0.95} /></mesh>
        <mesh position={[0, 0.5, 0]}><sphereGeometry args={[0.11, 16, 12]} /><Mat c="#F5F5F7" r={1} /></mesh>
      </group>)
    case 'bucket': return (
      <group position={[0, y + 0.25, 0]} rotation={[-0.08, 0, 0]}>
        <mesh><cylinderGeometry args={[0.36, 0.45, 0.32, 32]} /><Mat c={c} r={0.9} /></mesh>
        <mesh position={[0, -0.15, 0]} rotation={[0, 0, 0]}><cylinderGeometry args={[0.66, 0.62, 0.025, 36]} /><Mat c={shade(c, -0.05)} r={0.9} /></mesh>
      </group>)
    case 'beret': return <mesh position={[0.06, y + 0.31, -0.02]} rotation={[0, 0, -0.22]} scale={[1.08, 0.34, 1.02]}><sphereGeometry args={[0.44, 32, 20]} /><Mat c={c} r={0.95} /></mesh>
    case 'cowboy': return (
      <group position={[0, y + 0.31, 0]} rotation={[-0.05, 0, 0]}>
        <mesh><cylinderGeometry args={[0.3, 0.37, 0.34, 28]} /><Mat c={c} r={0.85} /></mesh>
        <mesh position={[0, 0.17, 0]} scale={[1, 0.3, 0.75]}><sphereGeometry args={[0.3, 20, 12]} /><Mat c={c} r={0.85} /></mesh>
        <mesh position={[0, -0.13, 0]} scale={[1, 1, 0.82]}><cylinderGeometry args={[0.78, 0.78, 0.03, 40]} /><Mat c={shade(c, -0.05)} r={0.85} /></mesh>
        {([-1, 1] as const).map((s) => <mesh key={s} position={[s * 0.74, -0.06, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.82]}><torusGeometry args={[0.08, 0.03, 8, 16, Math.PI]} /><Mat c={shade(c, -0.05)} /></mesh>)}
        <mesh position={[0, -0.08, 0]}><cylinderGeometry args={[0.375, 0.375, 0.06, 28, 1, true]} /><Mat c="#3B2A20" side={THREE.DoubleSide} /></mesh>
      </group>)
    case 'tophat': return (
      <group position={[0, y + 0.34, 0]}>
        <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.3, 0.3, 0.55, 32]} /><Mat c={c} r={0.4} /></mesh>
        <mesh position={[0, 0, 0]}><cylinderGeometry args={[0.305, 0.305, 0.09, 32]} /><Mat c={shade(c === '#111827' ? '#F0262F' : c, -0.25)} /></mesh>
        <mesh position={[0, -0.06, 0]}><cylinderGeometry args={[0.5, 0.5, 0.03, 36]} /><Mat c={c} r={0.4} /></mesh>
      </group>)
    case 'wizard': return (
      <group position={[0, y + 0.3, 0]} rotation={[-0.12, 0, 0.08]}>
        <mesh position={[0, 0.42, -0.04]} rotation={[-0.15, 0, -0.12]}><coneGeometry args={[0.38, 0.95, 32]} /><Mat c={c} r={0.8} /></mesh>
        <mesh><cylinderGeometry args={[0.64, 0.64, 0.03, 36]} /><Mat c={c} r={0.8} /></mesh>
        {[[0.12, 0.3, 0.27], [-0.1, 0.55, 0.18], [0.04, 0.12, 0.33]].map((p, i) => <mesh key={i} position={p as [number, number, number]}><sphereGeometry args={[0.035, 8, 6]} /><Mat c={GOLD} e="#B07800" /></mesh>)}
      </group>)
    case 'crown': return (
      <group position={[0, y + 0.34, 0]}>
        <mesh><cylinderGeometry args={[0.32, 0.3, 0.16, 32, 1, true]} /><Mat c={GOLD} r={0.25} m={0.8} side={THREE.DoubleSide} /></mesh>
        {Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2; return <group key={i}>
          <mesh position={[Math.sin(a) * 0.31, 0.15, Math.cos(a) * 0.31]}><coneGeometry args={[0.06, 0.16, 8]} /><Mat c={GOLD} r={0.25} m={0.8} /></mesh>
          <mesh position={[Math.sin(a) * 0.325, 0, Math.cos(a) * 0.325]}><sphereGeometry args={[0.03, 10, 8]} /><Mat c={['#F0262F', '#3B82F6', '#3CCB7F'][i % 3]} r={0.1} m={0.3} /></mesh>
        </group> })}
      </group>)
    case 'headphones': return (
      <group position={[0, y, 0]}>
        <mesh rotation={[0, 0, 0]}><torusGeometry args={[0.46, 0.035, 10, 40, Math.PI]} /><Mat c={c} r={0.4} /></mesh>
        {([-1, 1] as const).map((s) => <group key={s} position={[s * 0.44, -0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
          <mesh><cylinderGeometry args={[0.14, 0.14, 0.1, 24]} /><Mat c={c} r={0.4} /></mesh>
          <mesh position={[0, s * -0.06, 0]}><cylinderGeometry args={[0.11, 0.11, 0.03, 24]} /><Mat c="#111827" /></mesh>
        </group>)}
      </group>)
    case 'bandana': return (
      <group position={[0, y + 0.12, 0]} rotation={[-0.15, 0, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 1.02, 1]}><torusGeometry args={[0.415, 0.065, 10, 40]} /><Mat c={c} r={0.9} /></mesh>
        <mesh position={[0, 0, -0.44]}><sphereGeometry args={[0.07, 12, 10]} /><Mat c={c} r={0.9} /></mesh>
        {([-1, 1] as const).map((s) => <mesh key={s} position={[s * 0.07, -0.13, -0.48]} rotation={[0.3, 0, s * 0.4]}><boxGeometry args={[0.08, 0.22, 0.02]} /><Mat c={c} r={0.9} /></mesh>)}
      </group>)
    case 'halo': return <Floating y={y + 0.62}><mesh rotation={[Math.PI / 2 - 0.15, 0, 0]}><torusGeometry args={[0.3, 0.032, 12, 40]} /><meshStandardMaterial color="#FFE69A" emissive="#FFC531" emissiveIntensity={1.4} roughness={0.2} /></mesh></Floating>
    case 'cat': return (
      <group position={[0, y, 0]}>
        {([-1, 1] as const).map((s) => <group key={s} position={[s * 0.26, 0.36, -0.02]} rotation={[0, 0, s * -0.38]}>
          <mesh><coneGeometry args={[0.13, 0.27, 4]} /><Mat c={c} /></mesh>
          <mesh position={[0, -0.02, 0.05]} scale={[0.6, 0.7, 0.4]}><coneGeometry args={[0.13, 0.27, 4]} /><Mat c="#F9A8D4" /></mesh>
        </group>)}
      </group>)
    case 'horns': return (
      <group position={[0, y, 0]}>
        {([-1, 1] as const).map((s) => <mesh key={s} position={[s * 0.24, 0.36, 0.06]} rotation={[0.2, 0, s * -0.45]}><coneGeometry args={[0.07, 0.3, 14]} /><Mat c={c} r={0.4} /></mesh>)}
      </group>)
    case 'flowers': return (
      <group position={[0, y + 0.2, 0]} rotation={[-0.25, 0, 0]}>
        {Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2; return <group key={i} position={[Math.sin(a) * 0.4, 0, Math.cos(a) * 0.4]}>
          <mesh><sphereGeometry args={[0.065, 12, 10]} /><Mat c={['#EC4899', '#FFC531', '#F5F5F7', '#A855F7', '#F0262F'][i % 5]} r={0.7} /></mesh>
          <mesh position={[0, 0.03, 0.03]}><sphereGeometry args={[0.025, 8, 6]} /><Mat c="#FFC531" /></mesh>
        </group> })}
      </group>)
  }
  return null
}

function Floating({ y, children }: { y: number; children: React.ReactNode }) {
  const r = useRef<THREE.Group>(null)
  useFrame(({ clock }) => { if (r.current) r.current.position.y = y + Math.sin(clock.elapsedTime * 2) * 0.025 })
  return <group ref={r} position={[0, y, 0]}>{children}</group>
}

// ---------- geyim naxışı (CanvasTexture) ----------
function usePattern(cfg: AvatarConfig) {
  return useMemo(() => {
    if (cfg.pattern === 'solid' && cfg.top !== 'jersey') return null
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256
    const g = cv.getContext('2d')!
    const pat = cfg.top === 'jersey' && cfg.pattern === 'solid' ? 'number' : cfg.pattern
    if (pat === 'stripes') { g.fillStyle = cfg.topColor2; for (let i = 0; i < 6; i++) g.fillRect(0, 18 + i * 42, 256, 16) }
    if (pat === 'logo') {
      g.fillStyle = cfg.topColor2; g.font = '800 92px Figtree, Montserrat, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('J', 116, 132)
      const gr = g.createLinearGradient(150, 150, 190, 190); gr.addColorStop(0, '#EE1D2C'); gr.addColorStop(1, '#FF8A1A'); g.fillStyle = gr; g.beginPath(); g.arc(166, 166, 14, 0, Math.PI * 2); g.fill()
    }
    if (pat === 'number') { g.fillStyle = cfg.topColor2; g.font = '900 140px Montserrat, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(cfg.number), 128, 140) }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
    return t
  }, [cfg.pattern, cfg.top, cfg.topColor2, cfg.number])
}

// ---------- personaj ----------
/** Gövdə profili (lathe): bel daralır, sinə və çiyinlər yumrulanır. y — 0.88…1.60 bərabər addımlarla (UV xətti olsun). */
const TORSO_Y0 = 0.97, TORSO_Y1 = 1.6
function torsoR(y: number) {
  const u = (y - TORSO_Y0) / (TORSO_Y1 - TORSO_Y0)
  const body = 0.262 + 0.03 * Math.sin(u * Math.PI * 1.25 - 0.4) + 0.012 * Math.cos(u * 9)
  const top = u > 0.82 ? Math.sqrt(Math.max(0, 1 - ((u - 0.82) / 0.18) ** 2)) : 1 // çiyin dairəviliyi
  return Math.max(0.0001, body * top)
}
function useTorso() {
  return useMemo(() => {
    const pts: THREE.Vector2[] = []
    for (let k = 0; k <= 24; k++) { const y = TORSO_Y0 + (k / 24) * (TORSO_Y1 - TORSO_Y0); pts.push(new THREE.Vector2(k === 0 ? 0.0001 : torsoR(y), y)) }
    pts.unshift(new THREE.Vector2(0.0001, TORSO_Y0))
    return new THREE.LatheGeometry(pts, 48, Math.PI, Math.PI * 2)
  }, [])
}

export function Character({ cfg, interactive = false }: { cfg: AvatarConfig; interactive?: boolean }) {
  const bw = BUILD[cfg.build as keyof typeof BUILD] ?? 1
  const root = useRef<THREE.Group>(null), lArm = useRef<THREE.Group>(null), rArm = useRef<THREE.Group>(null), lEl = useRef<THREE.Group>(null), rEl = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null), chest = useRef<THREE.Group>(null), flame = useRef<THREE.Group>(null), cape = useRef<THREE.Mesh>(null)
  const pose = useRef({ la: 0.12, ra: 0.12, lx: 0, rx: 0, le: -0.15, re: -0.15, hy: 0, hx: 0 })
  const tex = usePattern(cfg)
  const torso = useTorso()
  const skin = cfg.skin, tc = cfg.topColor, bc = cfg.bottomColor, sc = cfg.shoeColor
  const sleeves: 'none' | 'short' | 'long' = cfg.top === 'tank' || cfg.top === 'dress' ? 'none' : cfg.top === 'tshirt' || cfg.top === 'jersey' ? 'short' : 'long'
  const shoulderX = 0.3 * bw + 0.1
  const hatOn = cfg.hat !== 'none' && cfg.hat !== 'halo' && cfg.hat !== 'headphones' && cfg.hat !== 'cat' && cfg.hat !== 'horns' && cfg.hat !== 'flowers'

  useFrame(({ clock, pointer }, dt) => {
    const t = clock.elapsedTime
    if (!root.current || !lArm.current || !rArm.current || !head.current) return
    const p = cfg.pose
    root.current.position.y = p === 'cheer' ? Math.abs(Math.sin(t * 4)) * 0.08 : p === 'dance' ? Math.abs(Math.sin(t * 5)) * 0.05 : Math.sin(t * 1.6) * 0.008
    root.current.rotation.y = p === 'dance' ? Math.sin(t * 2.5) * 0.35 : 0
    root.current.rotation.z = p === 'idle' || p === 'wave' ? Math.sin(t * 0.55) * 0.012 : 0 // ağırlığı ayaqdan ayağa keçirmə
    if (chest.current) { const b = Math.sin(t * 1.7); chest.current.scale.set(1 + b * 0.006, 1 + b * 0.008, 1 + b * 0.014) } // nəfəs
    // hədəf bucaqlar ("çölə" müsbət): sol qol −z, sağ qol +z
    let la = 0.12, ra = 0.12, le = -0.18, re = -0.18
    if (p === 'wave') { ra = 2.2 + Math.sin(t * 7) * 0.28; re = -0.55 + Math.sin(t * 7) * 0.25 }
    if (p === 'cheer') { la = 2.45 + Math.sin(t * 8) * 0.12; ra = 2.45 + Math.sin(t * 8) * 0.12; le = re = -0.25 }
    if (p === 'dance') { la = 0.75 + Math.sin(t * 5) * 0.65; ra = 0.75 + Math.sin(t * 5 + Math.PI) * 0.65; le = -0.9 + Math.sin(t * 5) * 0.4; re = -0.9 - Math.sin(t * 5) * 0.4 }
    const holding = cfg.hand !== 'none' && p === 'idle'
    if (holding) { ra = 0.16; re = -1.05 }
    const lx = la > 1.2 ? 0.35 : 0, rx = holding ? -0.25 : ra > 1.2 ? 0.35 : 0
    // yumşaq keçid (pozalar arasında sıçrayış olmasın)
    const P = pose.current, k = 1 - Math.exp(-dt * 9)
    P.la += (la - P.la) * k; P.ra += (ra - P.ra) * k; P.lx += (lx - P.lx) * k; P.rx += (rx - P.rx) * k; P.le += (le - P.le) * k; P.re += (re - P.re) * k
    lArm.current.rotation.set(P.lx, 0, -P.la); rArm.current.rotation.set(P.rx, 0, P.ra)
    if (lEl.current) lEl.current.rotation.x = P.le
    if (rEl.current) rEl.current.rotation.x = P.re
    // baş: incə yellənmə + (studiyada) kursoru izləmə
    const hy = interactive ? THREE.MathUtils.clamp(pointer.x, -1, 1) * 0.4 : 0, hx = interactive ? THREE.MathUtils.clamp(-pointer.y, -1, 1) * 0.18 : 0
    P.hy += (hy - P.hy) * (1 - Math.exp(-dt * 4)); P.hx += (hx - P.hx) * (1 - Math.exp(-dt * 4))
    head.current.rotation.set(Math.sin(t * 0.7) * 0.03 + P.hx, P.hy, Math.sin(t * 0.9) * 0.035 + (p === 'dance' ? Math.sin(t * 5) * 0.08 : 0))
    if (flame.current) flame.current.scale.y = 0.8 + Math.sin(t * 30) * 0.2
    if (cape.current) cape.current.rotation.x = 0.12 + Math.sin(t * 2) * 0.04
  })

  const legX = 0.13 * bw
  const dress = cfg.top === 'dress'
  const legCover = dress ? (cfg.bottom === 'leggings' ? 'leggings' : 'skin') : cfg.bottom
  const pants = legCover !== 'shorts' && legCover !== 'skirt' && legCover !== 'skin'

  return (
    <group ref={root}>
      {/* ayaqqabılar */}
      {([-1, 1] as const).map((s) => <Shoe key={s} x={s * legX} kind={cfg.shoes} color={sc} skin={skin} />)}
      {/* ayaqlar: bud + baldır (konusvari), diz */}
      {([-1, 1] as const).map((s) => (
        <group key={s} position={[s * legX, 0, 0]}>
          {!pants ? <>
            <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.088, 0.072, 0.4, 20]} /><Skin c={skin} /></mesh>
            <mesh position={[0, 0.5, 0.005]}><sphereGeometry args={[0.09, 18, 14]} /><Skin c={skin} /></mesh>
            <mesh position={[0, 0.7, 0]}><cylinderGeometry args={[0.112, 0.09, 0.4, 20]} /><Skin c={skin} /></mesh>
            {legCover === 'shorts' && <mesh position={[0, 0.76, 0]}><cylinderGeometry args={[0.138, 0.128, 0.3, 22]} /><Mat c={bc} /></mesh>}
          </> : <>
            <mesh position={[0, 0.32, 0]}><cylinderGeometry args={[legCover === 'leggings' ? 0.1 : 0.118, legCover === 'joggers' ? 0.092 : legCover === 'leggings' ? 0.078 : 0.112, 0.44, 22]} /><Mat c={bc} r={legCover === 'jeans' ? 0.95 : 0.8} /></mesh>
            <mesh position={[0, 0.54, 0]}><sphereGeometry args={[legCover === 'leggings' ? 0.1 : 0.118, 20, 14]} /><Mat c={bc} r={legCover === 'jeans' ? 0.95 : 0.8} /></mesh>
            <mesh position={[0, 0.74, 0]}><cylinderGeometry args={[legCover === 'leggings' ? 0.115 : 0.135, legCover === 'leggings' ? 0.1 : 0.118, 0.42, 22]} /><Mat c={bc} r={legCover === 'jeans' ? 0.95 : 0.8} /></mesh>
            {legCover === 'joggers' && <mesh position={[0, 0.13, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.092, 0.024, 8, 20]} /><Mat c={shade(bc, -0.1)} /></mesh>}
            {legCover === 'joggers' && <mesh position={[s * 0.118, 0.5, 0]} rotation={[0, 0, s * 0.03]}><boxGeometry args={[0.012, 0.74, 0.04]} /><Mat c="#F5F5F7" /></mesh>}
            {legCover === 'jeans' && <><mesh position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.112, 0.02, 8, 20]} /><Mat c={shade(bc, 0.15)} /></mesh>
              <mesh position={[s * 0.06, 0.82, 0.1]} rotation={[0.25, 0, 0]}><boxGeometry args={[0.07, 0.004, 0.03]} /><Mat c={shade(bc, 0.2)} flat /></mesh></>}
            {legCover === 'cargo' && <RoundedBox args={[0.1, 0.14, 0.05]} radius={0.015} position={[s * 0.125, 0.62, 0.02]} rotation={[0, s * 0.9, 0]}><Mat c={shade(bc, -0.08)} /></RoundedBox>}
          </>}
        </group>
      ))}
      {/* omba */}
      {!dress && legCover !== 'skin' && legCover !== 'skirt' && <RoundedBox args={[0.58 * bw, 0.28, 0.36]} radius={0.12} smoothness={5} position={[0, 0.93, 0]}><Mat c={bc} r={legCover === 'jeans' ? 0.95 : 0.8} /></RoundedBox>}
      {!dress && pants && <mesh position={[0, 1.04, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[bw * 1.02, 0.62, 1]}><torusGeometry args={[0.278, 0.018, 8, 40]} /><Mat c={shade(bc, -0.12)} /></mesh>}
      {(legCover === 'skirt' || dress) && <mesh position={[0, 0.78, 0]}><cylinderGeometry args={[0.28 * bw, 0.46 * bw, 0.42, 40, 1, true]} /><Mat c={dress ? tc : bc} side={THREE.DoubleSide} /></mesh>}
      {legCover === 'skirt' && !dress && <RoundedBox args={[0.54 * bw, 0.18, 0.32]} radius={0.08} position={[0, 0.98, 0]}><Mat c={bc} /></RoundedBox>}

      {/* gövdə (nəfəs alır) */}
      <group ref={chest} position={[0, 0.97, 0]}>
        <group position={[0, -0.97, 0]}>
          <mesh geometry={torso} scale={[bw, 1, 0.64]} castShadow><Mat c={tc} r={cfg.top === 'jacket' ? 0.55 : 0.85} /></mesh>
          {tex && <mesh geometry={torso} scale={[bw * 1.006, 1.001, 0.645]} renderOrder={1}><meshPhysicalMaterial map={tex} transparent roughness={0.8} sheen={0.4} sheenColor="#ffffff" polygonOffset polygonOffsetFactor={-2} depthWrite={false} /></mesh>}
          <TopDetails cfg={cfg} bw={bw} />
        </group>
      </group>

      {/* qollar */}
      <Arm side={-1} armRef={lArm} elbowRef={lEl} cfg={cfg} sleeves={sleeves} shoulderX={shoulderX} /><Arm side={1} armRef={rArm} elbowRef={rEl} cfg={cfg} sleeves={sleeves} shoulderX={shoulderX} />

      {/* boyun + boyun aksesuarı */}
      <mesh position={[0, 1.62, 0]}><cylinderGeometry args={[0.085, 0.105, 0.2, 20]} /><Skin c={skin} /></mesh>
      <Neck kind={cfg.neck} color={cfg.neckColor} />
      <Back kind={cfg.back} color={cfg.backColor} bw={bw} flame={flame} cape={cape} />

      {/* baş */}
      <group ref={head} position={[0, 1.66, 0]}>
        <group position={[0, -1.66, 0]}>
          <mesh position={[0, HEAD_Y, 0]} scale={[1, 0.96, 0.95]} castShadow><sphereGeometry args={[HEAD_R, 64, 48]} /><Skin c={skin} /></mesh>
          {/* çənə və yanaqlar — üzə həcm */}
          <mesh position={[0, HEAD_Y - 0.17, 0.07]} scale={[0.84, 0.62, 0.78]}><sphereGeometry args={[0.3, 40, 28]} /><Skin c={skin} /></mesh>
          {([-1, 1] as const).map((s) => <group key={s} position={[s * 0.392, HEAD_Y - 0.02, 0]} rotation={[0, s * 0.25, 0]}>
            <mesh scale={[0.55, 1, 0.8]}><sphereGeometry args={[0.085, 20, 14]} /><Skin c={shade(skin, -0.03)} /></mesh>
            <mesh position={[s * 0.02, 0, 0.015]} rotation={[0, s * Math.PI / 2, 0]} scale={[0.7, 1, 1]}><torusGeometry args={[0.042, 0.011, 8, 18]} /><Skin c={shade(skin, -0.08)} /></mesh>
          </group>)}
          {/* burun: körpü + uc + pərlər */}
          <mesh position={onFace(0, 1.95, -0.03)} rotation={[-0.35, 0, 0]}><capsuleGeometry args={[0.022, 0.06, 6, 12]} /><Skin c={shade(skin, -0.02)} /></mesh>
          <mesh position={onFace(0, 1.915, -0.006)}><sphereGeometry args={[0.036, 20, 14]} /><Skin c={shade(skin, -0.03)} /></mesh>
          {([-1, 1] as const).map((s) => <mesh key={s} position={onFace(s * 0.028, 1.905, -0.016)}><sphereGeometry args={[0.022, 14, 10]} /><Skin c={shade(skin, -0.04)} /></mesh>)}
          <Eye x={-0.14} side={-1} kind={cfg.eyes} color={cfg.eyeColor} skin={skin} />
          <Eye x={0.14} side={1} kind={cfg.eyes} color={cfg.eyeColor} skin={skin} />
          <Brows kind={cfg.eyes === 'angry' && cfg.brows === 'soft' ? 'angry' : cfg.brows} color={cfg.hairColor} />
          <Mouth kind={cfg.mouth} />
          {cfg.blush && ([-1, 1] as const).map((s) => <mesh key={s} position={onFace(s * 0.23, 1.89, 0.003)} rotation={faceRot(s * 0.23)}><circleGeometry args={[0.055, 24]} /><meshBasicMaterial color="#FF6B8B" transparent opacity={0.28} depthWrite={false} /></mesh>)}
          {cfg.freckles && ([-1, 1] as const).flatMap((s) => [[0.2, 1.93], [0.25, 1.9], [0.19, 1.88], [0.24, 1.94]].map(([x, y], i) => <mesh key={`${s}${i}`} position={onFace(s * x, y, 0.004)}><sphereGeometry args={[0.009, 6, 6]} /><Mat c="#8A5A32" flat /></mesh>))}
          <FacialHair kind={cfg.facial} color={cfg.hairColor} />
          <Hair kind={cfg.hair} color={cfg.hairColor} hat={hatOn} />
          <Glasses kind={cfg.glasses} color={cfg.glassesColor} />
          <Hat kind={cfg.hat} color={cfg.hatColor} />
        </group>
      </group>
    </group>
  )
}

/** Əl: ovuc + baş barmaq + dörd barmaq (bir az bükülü). */
function Hand({ skin, side, grip = false }: { skin: string; side: 1 | -1; grip?: boolean }) {
  const curl = grip ? 1.1 : 0.35
  return (
    <group>
      <RoundedBox args={[0.1, 0.1, 0.055]} radius={0.025} smoothness={3} position={[0, -0.03, 0]}><Skin c={skin} /></RoundedBox>
      {[-0.034, -0.011, 0.012, 0.034].map((x, i) => (
        <group key={i} position={[x, -0.075, 0.004]} rotation={[-curl, 0, 0]}>
          <mesh position={[0, -0.028 + (i === 0 || i === 3 ? 0.006 : 0), 0]}><capsuleGeometry args={[0.0125, i === 0 || i === 3 ? 0.032 : 0.042, 4, 8]} /><Skin c={skin} /></mesh>
        </group>
      ))}
      <group position={[side * -0.052, -0.035, 0.018]} rotation={[-0.4, 0, side * -0.7]}>
        <mesh position={[0, -0.025, 0]}><capsuleGeometry args={[0.014, 0.036, 4, 8]} /><Skin c={skin} /></mesh>
      </group>
    </group>
  )
}

function Arm({ side, armRef, elbowRef, cfg, sleeves, shoulderX }: { side: 1 | -1; armRef: React.RefObject<THREE.Group | null>; elbowRef: React.RefObject<THREE.Group | null>; cfg: AvatarConfig; sleeves: 'none' | 'short' | 'long'; shoulderX: number }) {
  const tc = cfg.topColor, skin = cfg.skin
  const upper = sleeves === 'long' ? tc : null
  const fore = sleeves === 'long' ? tc : null
  const joint = sleeves === 'none' ? null : tc
  const holding = side === 1 && cfg.hand !== 'none'
  return (
    <group ref={armRef} position={[side * shoulderX, 1.48, 0]}>
      {/* çiyin oynağı */}
      <mesh><sphereGeometry args={[0.105, 22, 16]} />{joint ? <Mat c={joint} r={0.85} /> : <Skin c={skin} />}</mesh>
      {/* bazu */}
      <mesh position={[0, -0.15, 0]}><capsuleGeometry args={[0.088, 0.22, 8, 16]} />{upper ? <Mat c={upper} r={0.85} /> : <Skin c={skin} />}</mesh>
      {sleeves === 'short' && <mesh position={[0, -0.09, 0]}><cylinderGeometry args={[0.112, 0.104, 0.2, 20]} /><Mat c={tc} /></mesh>}
      {sleeves === 'short' && cfg.top === 'jersey' && <mesh position={[0, -0.185, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.104, 0.013, 8, 22]} /><Mat c={cfg.topColor2} /></mesh>}
      {/* dirsək və qolun aşağı hissəsi */}
      <group ref={elbowRef} position={[0, -0.3, 0]}>
        <mesh><sphereGeometry args={[0.082, 18, 14]} />{fore ? <Mat c={fore} r={0.85} /> : <Skin c={skin} />}</mesh>
        <mesh position={[0, -0.13, 0]}><capsuleGeometry args={[0.074, 0.2, 8, 16]} />{fore ? <Mat c={fore} r={0.85} /> : <Skin c={skin} />}</mesh>
        {sleeves === 'long' && (cfg.top === 'hoodie' || cfg.top === 'sweater') && <mesh position={[0, -0.24, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.074, 0.02, 8, 20]} /><Mat c={cfg.top === 'sweater' ? cfg.topColor2 : shade(tc, -0.08)} /></mesh>}
        <group position={[0, -0.27, 0]}><Hand skin={skin} side={side} grip={holding} /></group>
        {side === 1 && <group position={[0, 0.3, 0]}><HandItem kind={cfg.hand} cfg={cfg} /></group>}
        {side === -1 && cfg.back === 'tote' && <group position={[-0.03, -0.36, 0.03]}>
          <mesh position={[0, -0.02, 0]} scale={[0.8, 1.6, 1]}><torusGeometry args={[0.06, 0.01, 6, 16, Math.PI]} /><Mat c={shade(cfg.backColor, -0.2)} /></mesh>
          <RoundedBox args={[0.26, 0.3, 0.06]} radius={0.03} position={[0, -0.2, 0]}><Mat c={cfg.backColor} r={0.9} /></RoundedBox>
        </group>}
      </group>
    </group>
  )
}

function TopDetails({ cfg, bw }: { cfg: AvatarConfig; bw: number }) {
  const tc = cfg.topColor, c2 = cfg.topColor2
  switch (cfg.top) {
    case 'hoodie': return <>
      <mesh position={[0, 1.58, -0.13]} rotation={[Math.PI / 2 - 0.35, 0, 0]}><torusGeometry args={[0.24, 0.1, 12, 28]} /><Mat c={shade(tc, -0.05)} r={0.9} /></mesh>
      <RoundedBox args={[0.36 * bw, 0.16, 0.05]} radius={0.04} position={[0, 1.03, 0.185]}><Mat c={shade(tc, -0.06)} r={0.9} /></RoundedBox>
      {([-1, 1] as const).map((s) => <mesh key={s} position={[s * 0.07, 1.42, 0.2]}><cylinderGeometry args={[0.009, 0.009, 0.2, 8]} /><Mat c={c2} /></mesh>)}
    </>
    case 'jacket': return <>
      <mesh position={[0, 1.55, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.15, 0.045, 10, 28]} /><Mat c={c2} r={0.9} /></mesh>
      <mesh position={[0, 1.0, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[bw, 0.64, 1]}><torusGeometry args={[torsoR(1.0) + 0.012, 0.035, 10, 48]} /><Mat c={c2} r={0.9} /></mesh>
      <mesh position={[0, 1.22, torsoR(1.22) * 0.64 + 0.004]}><boxGeometry args={[0.012, 0.62, 0.01]} /><Mat c="#C9CDD8" m={0.8} r={0.3} /></mesh>
      <mesh position={[-0.17 * bw, 1.36, 0.19]} rotation={[0, 0, 0.6]}><boxGeometry args={[0.05, 0.02, 0.01]} /><Mat c={c2} /></mesh>
    </>
    case 'sweater': return <>
      <mesh position={[0, 1.0, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[bw, 0.64, 1]}><torusGeometry args={[torsoR(1.0) + 0.012, 0.035, 10, 48]} /><Mat c={c2} r={0.95} /></mesh>
      <mesh position={[0, 1.55, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.13, 0.035, 10, 28]} /><Mat c={c2} r={0.95} /></mesh>
    </>
    case 'shirt': return <>
      {([-1, 1] as const).map((s) => <mesh key={s} position={[s * 0.07, 1.52, 0.15]} rotation={[0.3, 0, s * 0.9]}><coneGeometry args={[0.06, 0.12, 3]} /><Mat c={shade(tc, 0.04)} /></mesh>)}
      <mesh position={[0, 1.48, 0.2]}><boxGeometry args={[0.06, 0.06, 0.03]} /><Mat c={c2} /></mesh>
      <mesh position={[0, 1.27, 0.2]} scale={[1, 1, 0.3]}><coneGeometry args={[0.05, 0.38, 4]} /><Mat c={c2} /></mesh>
    </>
    case 'tank': return <>{([-1, 1] as const).map((s) => <mesh key={s} position={[s * 0.15 * bw, 1.53, 0]}><boxGeometry args={[0.06, 0.05, 0.27]} /><Mat c={tc} /></mesh>)}</>
    case 'dress': return <mesh position={[0, 1.0, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[bw, 0.64, 1]}><torusGeometry args={[torsoR(1.0) + 0.006, 0.022, 8, 48]} /><Mat c={c2} /></mesh>
    default: return <mesh position={[0, 1.55, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.12, 0.022, 8, 24]} /><Mat c={cfg.top === 'jersey' ? c2 : shade(tc, -0.06)} /></mesh>
  }
}

function Shoe({ x, kind, color, skin }: { x: number; kind: AvatarConfig['shoes']; color: string; skin: string }) {
  const sole = kind === 'boots' ? '#2B1B12' : kind === 'loafers' ? '#3B2A20' : '#F5F5F7'
  const h = kind === 'hightops' ? 0.22 : kind === 'boots' ? 0.26 : kind === 'loafers' ? 0.09 : kind === 'slides' ? 0.04 : 0.12
  return (
    <group position={[x, 0, 0.04]}>
      <RoundedBox args={[0.19, 0.04, 0.32]} radius={0.018} position={[0, 0.02, 0]}><Mat c={sole} r={0.9} /></RoundedBox>
      {kind === 'slides' ? <>
        <mesh position={[0, 0.07, 0.03]}><boxGeometry args={[0.2, 0.05, 0.12]} /><Mat c={color} r={0.6} /></mesh>
        <mesh position={[0, 0.07, 0.12]} scale={[1, 0.6, 0.8]}><sphereGeometry args={[0.07, 12, 8]} /><Mat c={skin} r={0.6} /></mesh>
      </> : <RoundedBox args={[0.18, h, 0.3]} radius={Math.min(0.06, h / 2.2)} position={[0, 0.04 + h / 2, 0]}><Mat c={color} r={kind === 'loafers' ? 0.35 : 0.7} /></RoundedBox>}
      {(kind === 'sneakers' || kind === 'hightops') && <mesh position={[0, 0.04 + h * 0.6, 0.152]}><boxGeometry args={[0.1, 0.012, 0.004]} /><Mat c={shade(color, -0.25)} /></mesh>}
    </group>
  )
}

function Neck({ kind, color }: { kind: AvatarConfig['neck']; color: string }) {
  switch (kind) {
    case 'scarf': return <>
      <mesh position={[0, 1.57, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.15, 0.07, 12, 28]} /><Mat c={color} r={0.95} /></mesh>
      <RoundedBox args={[0.12, 0.34, 0.04]} radius={0.02} position={[-0.09, 1.38, 0.21]} rotation={[0, 0, 0.08]}><Mat c={color} r={0.95} /></RoundedBox>
    </>
    case 'chain': return <>
      <mesh position={[0, 1.5, 0.06]} rotation={[Math.PI / 2 - 0.45, 0, 0]}><torusGeometry args={[0.17, 0.012, 8, 32]} /><Mat c={GOLD} m={0.8} r={0.25} /></mesh>
      <mesh position={[0, 1.36, 0.2]}><sphereGeometry args={[0.035, 12, 10]} /><Mat c={color} m={0.4} r={0.2} /></mesh>
    </>
    case 'bowtie': return <group position={[0, 1.52, 0.2]}>
      {([-1, 1] as const).map((s) => <mesh key={s} position={[s * 0.05, 0, 0]} rotation={[0, 0, s * Math.PI / 2]}><coneGeometry args={[0.04, 0.09, 4]} /><Mat c={color} /></mesh>)}
      <mesh><sphereGeometry args={[0.022, 10, 8]} /><Mat c={shade(color, -0.12)} /></mesh>
    </group>
    case 'medal': return <>
      {([-1, 1] as const).map((s) => <mesh key={s} position={[s * 0.05, 1.42, 0.2]} rotation={[0, 0, s * 0.35]}><boxGeometry args={[0.04, 0.22, 0.01]} /><Mat c={color} /></mesh>)}
      <mesh position={[0, 1.29, 0.21]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.06, 0.06, 0.015, 24]} /><Mat c={GOLD} m={0.85} r={0.25} /></mesh>
    </>
  }
  return null
}

function Back({ kind, color, bw, flame, cape }: { kind: AvatarConfig['back']; color: string; bw: number; flame: React.RefObject<THREE.Group | null>; cape: React.RefObject<THREE.Mesh | null> }) {
  switch (kind) {
    case 'backpack': return <>
      <RoundedBox args={[0.44 * bw, 0.5, 0.2]} radius={0.08} position={[0, 1.22, -0.29]}><Mat c={color} r={0.8} /></RoundedBox>
      <RoundedBox args={[0.28 * bw, 0.18, 0.06]} radius={0.04} position={[0, 1.08, -0.41]}><Mat c={shade(color, -0.08)} r={0.8} /></RoundedBox>
      {/* qayışlar çiynin üstündən keçir: arxadan önə qövs + öndə aşağı enən hissə */}
      {([-1, 1] as const).map((s) => <group key={s} position={[s * 0.17 * bw, 0, 0]}>
        <mesh position={[0, 1.37, -0.01]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.2, 0.022, 8, 28, Math.PI]} /><Mat c={shade(color, -0.15)} /></mesh>
        <mesh position={[0, 1.26, torsoR(1.26) * 0.64 + 0.01]}><boxGeometry args={[0.045, 0.24, 0.014]} /><Mat c={shade(color, -0.15)} /></mesh>
      </group>)}
    </>
    case 'crossbody': return <>
      <mesh position={[0, 1.22, 0]} rotation={[0, 0, 0.75]} scale={[1.05 * bw, 1, 0.68]}><torusGeometry args={[0.38, 0.016, 6, 40]} /><Mat c={shade(color, -0.2)} /></mesh>
      <RoundedBox args={[0.2, 0.15, 0.08]} radius={0.04} position={[0.14 * bw, 0.97, 0.22]}><Mat c={color} r={0.6} /></RoundedBox>
    </>
    case 'tote': return null // sol əldə tutulur (Arm)
    case 'guitar': return (
      <group position={[0, 1.15, -0.3]} rotation={[0, 0, 0.6]}>
        <mesh position={[0, -0.12, 0]} scale={[1, 1, 0.35]}><sphereGeometry args={[0.2, 20, 14]} /><Mat c={color} r={0.35} /></mesh>
        <mesh position={[0, 0.1, 0]} scale={[1, 1, 0.35]}><sphereGeometry args={[0.15, 20, 14]} /><Mat c={color} r={0.35} /></mesh>
        <mesh position={[0, 0.42, 0]}><boxGeometry args={[0.06, 0.5, 0.04]} /><Mat c="#3B2A20" /></mesh>
        <mesh position={[0, 0.7, 0]}><boxGeometry args={[0.09, 0.1, 0.04]} /><Mat c="#1F1611" /></mesh>
        <mesh position={[0, -0.02, -0.075]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.05, 0.05, 0.01, 18]} /><Mat c="#111" /></mesh>
      </group>)
    case 'wings': return <>{([-1, 1] as const).map((s) => (
      <group key={s} position={[s * 0.12, 1.32, -0.25]} rotation={[0.1, s * 0.5, s * -0.35]}>
        {[0, 1, 2].map((i) => <mesh key={i} position={[s * (0.22 + i * 0.07), 0.1 - i * 0.13, -i * 0.02]} rotation={[0, 0, s * (0.4 + i * 0.15)]} scale={[0.32 - i * 0.05, 0.1, 0.05]}><sphereGeometry args={[1, 18, 12]} /><Mat c={color} r={0.9} /></mesh>)}
      </group>))}</>
    case 'cape': return <mesh ref={cape} position={[0, 1.0, -0.2]} rotation={[0.12, 0, 0]}><cylinderGeometry args={[0.36 * bw, 0.5 * bw, 1.0, 28, 1, true, Math.PI * 0.6, Math.PI * 0.8]} /><Mat c={color} r={0.6} side={THREE.DoubleSide} /></mesh>
    case 'jetpack': return <group position={[0, 1.15, -0.3]}>
      {([-1, 1] as const).map((s) => <group key={s} position={[s * 0.12, 0, 0]}>
        <mesh><cylinderGeometry args={[0.1, 0.1, 0.45, 18]} /><Mat c={color} m={0.6} r={0.3} /></mesh>
        <mesh position={[0, 0.24, 0]}><sphereGeometry args={[0.1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /><Mat c={color} m={0.6} r={0.3} /></mesh>
        <mesh position={[0, -0.26, 0]}><cylinderGeometry args={[0.07, 0.09, 0.07, 16]} /><Mat c="#374151" m={0.7} r={0.3} /></mesh>
      </group>)}
      <group ref={flame} position={[0, -0.32, 0]}>
        {([-1, 1] as const).map((s) => <mesh key={s} position={[s * 0.12, -0.1, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.06, 0.24, 14]} /><meshStandardMaterial color="#FFB020" emissive="#FF6A00" emissiveIntensity={2} transparent opacity={0.9} /></mesh>)}
      </group>
    </group>
  }
  return null
}

function HandItem({ kind, cfg }: { kind: AvatarConfig['hand']; cfg: AvatarConfig }) {
  const at: [number, number, number] = [0.03, -0.66, 0.06]
  switch (kind) {
    case 'book': return <RoundedBox args={[0.2, 0.26, 0.06]} radius={0.015} position={at} rotation={[0.2, 0.3, 0]}><Mat c={cfg.topColor2 === cfg.topColor ? '#3B82F6' : cfg.topColor2} r={0.7} /></RoundedBox>
    case 'trophy': return <group position={[0.03, -0.62, 0.08]} scale={0.9}>
      <mesh position={[0, 0.14, 0]}><cylinderGeometry args={[0.1, 0.05, 0.16, 20]} /><Mat c={GOLD} m={0.85} r={0.25} /></mesh>
      {([-1, 1] as const).map((s) => <mesh key={s} position={[s * 0.1, 0.15, 0]} rotation={[0, 0, s * Math.PI / 2]}><torusGeometry args={[0.04, 0.012, 6, 14, Math.PI]} /><Mat c={GOLD} m={0.85} r={0.25} /></mesh>)}
      <mesh position={[0, 0.03, 0]}><cylinderGeometry args={[0.02, 0.02, 0.08, 10]} /><Mat c={GOLD} m={0.85} r={0.25} /></mesh>
      <mesh position={[0, -0.02, 0]}><boxGeometry args={[0.12, 0.04, 0.08]} /><Mat c="#3B2A20" /></mesh>
    </group>
    case 'mic': return <group position={[0.03, -0.6, 0.06]} rotation={[0.5, 0, 0]}>
      <mesh><cylinderGeometry args={[0.025, 0.02, 0.2, 12]} /><Mat c="#1F2937" /></mesh>
      <mesh position={[0, 0.13, 0]}><sphereGeometry args={[0.05, 16, 12]} /><Mat c="#9CA3AF" m={0.7} r={0.4} /></mesh>
    </group>
    case 'balloon': return <group position={[0.03, -0.62, 0.02]}>
      <mesh position={[0, 0.45, 0]}><cylinderGeometry args={[0.003, 0.003, 0.9, 4]} /><Mat c="#E5E7EB" /></mesh>
      <Floating y={0.98}><mesh scale={[1, 1.15, 1]}><sphereGeometry args={[0.2, 24, 18]} /><Mat c={cfg.backColor} r={0.25} /></mesh></Floating>
    </group>
    case 'phone': return <group position={at} rotation={[0.3, 0, 0]}>
      <RoundedBox args={[0.1, 0.19, 0.02]} radius={0.01}><Mat c="#111827" r={0.3} /></RoundedBox>
      <mesh position={[0, 0, 0.011]}><planeGeometry args={[0.085, 0.165]} /><meshStandardMaterial color="#6366F1" emissive="#6366F1" emissiveIntensity={0.8} /></mesh>
    </group>
    case 'icecream': return <group position={[0.03, -0.58, 0.06]}>
      <mesh rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.06, 0.18, 14]} /><Mat c="#D9A066" /></mesh>
      <mesh position={[0, 0.11, 0]}><sphereGeometry args={[0.07, 16, 12]} /><Mat c="#F9A8D4" /></mesh>
      <mesh position={[0, 0.2, 0]}><sphereGeometry args={[0.06, 16, 12]} /><Mat c="#86EFAC" /></mesh>
    </group>
  }
  return null
}
