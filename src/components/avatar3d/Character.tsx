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
const Mat = ({ c, r = 0.75, m = 0, e, o, side }: { c: string; r?: number; m?: number; e?: string; o?: number; side?: THREE.Side }) => (
  <meshStandardMaterial color={c} roughness={r} metalness={m} emissive={e ?? '#000'} emissiveIntensity={e ? 0.9 : 0} transparent={o != null} opacity={o ?? 1} side={side} />
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
function Eye({ x, kind, color, side }: { x: number; kind: AvatarConfig['eyes']; color: string; side: 1 | -1 }) {
  const y = 2.0, p = onFace(x, y), rot = faceRot(x)
  const star = useMemo(() => new THREE.ExtrudeGeometry(starShape(0.07, 0.03), { depth: 0.01, bevelEnabled: false }), [])
  const k = kind === 'wink' && side === 1 ? 'happy' : kind
  if (k === 'happy') return <mesh position={[p[0], p[1] - 0.01, p[2]]} rotation={rot}><torusGeometry args={[0.05, 0.015, 8, 20, Math.PI]} /><Mat c="#1B1210" r={0.4} /></mesh>
  if (k === 'sleepy') return <mesh position={p} rotation={[rot[0], rot[1], 0]}><torusGeometry args={[0.05, 0.014, 8, 20, Math.PI]} /><Mat c="#1B1210" r={0.4} /></mesh>
  if (k === 'star') return <mesh geometry={star} position={[p[0], p[1], p[2] - 0.004]} rotation={rot}><Mat c={GOLD} r={0.3} e="#7A5200" /></mesh>
  const big = k === 'sparkle' ? 1.3 : 1
  return (
    <group position={p} rotation={rot}>
      <mesh scale={[1, 1.15, 0.45]}><sphereGeometry args={[0.058 * big, 20, 16]} /><Mat c="#FFFFFF" r={0.3} /></mesh>
      <mesh position={[0, -0.004, 0.018]} scale={[1, 1.1, 0.4]}><sphereGeometry args={[0.042 * big, 20, 16]} /><Mat c={color} r={0.3} /></mesh>
      <mesh position={[0, -0.004, 0.028]} scale={[1, 1.1, 0.4]}><sphereGeometry args={[0.022 * big, 16, 12]} /><Mat c="#0B0B0F" r={0.2} /></mesh>
      <mesh position={[0.016 * big, 0.02 * big, 0.036]}><sphereGeometry args={[0.011 * big, 10, 8]} /><Mat c="#FFFFFF" r={0.1} e="#FFFFFF" /></mesh>
      {k === 'sparkle' && <mesh position={[-0.02, -0.025, 0.036]}><sphereGeometry args={[0.007, 8, 6]} /><Mat c="#FFFFFF" e="#FFFFFF" /></mesh>}
      {k === 'lashes' && [-0.5, 0, 0.5].map((a, i) => <mesh key={i} position={[side * 0.03 + a * 0.03, 0.07, 0]} rotation={[0, 0, a * -0.6 - side * 0.4]}><boxGeometry args={[0.008, 0.035, 0.008]} /><Mat c="#1B1210" /></mesh>)}
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
  if (kind === 'monocle') { const p = onFace(0.14, y, 0.03); return (
    <group position={p} rotation={faceRot(0.14)}>
      <mesh><torusGeometry args={[0.075, 0.01, 8, 28]} /><Mat c={GOLD} r={0.3} m={0.7} /></mesh>
      <mesh><circleGeometry args={[0.07, 24]} /><meshStandardMaterial color="#BFE3FF" transparent opacity={0.25} /></mesh>
      <mesh position={[0.06, -0.14, -0.02]} rotation={[0, 0, 0.3]}><cylinderGeometry args={[0.004, 0.004, 0.22]} /><Mat c={GOLD} m={0.7} r={0.3} /></mesh>
    </group>) }
  return (
    <group>
      {([-1, 1] as const).map((s) => {
        const p = onFace(s * 0.14, y, 0.03), r = faceRot(s * 0.14)
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
      <mesh position={onFace(0, y + 0.01, 0.035)}><boxGeometry args={[0.07, 0.015, 0.015]} /><Mat c={color} /></mesh>
      {([-1, 1] as const).map((s) => <mesh key={`a${s}`} position={[s * 0.395, y + 0.01, 0.08]} rotation={[0, s * 0.25, 0]}><boxGeometry args={[0.012, 0.012, 0.18]} /><Mat c={color} /></mesh>)}
    </group>
  )
}

function FacialHair({ kind, color }: { kind: AvatarConfig['facial']; color: string }) {
  if (kind === 'none') return null
  const c = shade(color, -0.04)
  if (kind === 'mustache') return (
    <group>{([-1, 1] as const).map((s) => <mesh key={s} position={onFace(s * 0.045, 1.875, 0.01)} rotation={[0, 0, s * -0.35]} scale={[1, 0.45, 0.5]}><sphereGeometry args={[0.055, 16, 10]} /><Mat c={c} r={0.9} /></mesh>)}</group>
  )
  if (kind === 'goatee') return <mesh position={onFace(0, 1.72, -0.02)} scale={[1, 1.2, 0.8]}><sphereGeometry args={[0.06, 16, 12]} /><Mat c={c} r={0.9} /></mesh>
  const beard = kind === 'beard'
  return (
    <group position={[0, HEAD_Y, 0]}>
      <mesh scale={[1, 0.95, 0.95]}>
        <sphereGeometry args={[HEAD_R + (beard ? 0.035 : 0.006), 32, 20, Math.PI / 2 - 1.15, 2.3, Math.PI * 0.56, Math.PI * 0.4]} />
        <Mat c={c} r={0.95} o={beard ? 1 : 0.45} side={THREE.DoubleSide} />
      </mesh>
      {beard && <mesh position={[0, -0.33, 0.24]} scale={[1.2, 1, 0.9]}><sphereGeometry args={[0.11, 16, 12]} /><Mat c={c} r={0.95} /></mesh>}
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
  const cap = (rad = 0.425, theta = 1.28, tilt = -0.32, o?: number) => (
    <mesh rotation={[tilt, 0, 0]}><sphereGeometry args={[rad, 36, 20, 0, Math.PI * 2, 0, theta]} /><Mat c={c} r={0.65} o={o} /></mesh>
  )
  return (
    <group position={[0, HEAD_Y, 0]}>
      {kind === 'buzz' ? cap(0.408, 1.25, -0.3, 0.9) : cap()}
      {(kind === 'short' || kind === 'sidepart') && (
        <mesh position={[kind === 'sidepart' ? 0.08 : 0, 0.29, 0.25]} rotation={[0.55, 0, kind === 'sidepart' ? -0.35 : 0]} scale={[kind === 'sidepart' ? 0.38 : 0.34, 0.1, 0.16]}><sphereGeometry args={[1, 20, 12]} /><Mat c={c} r={0.65} /></mesh>
      )}
      {kind === 'curly' && curls.map((p, i) => <mesh key={i} position={[p[0], p[1] + 0.02, p[2] - 0.02]}><sphereGeometry args={[0.085, 12, 10]} /><Mat c={c} r={0.8} /></mesh>)}
      {kind === 'afro' && <mesh position={[0, hat ? 0.05 : 0.14, -0.14]} scale={hat ? [1.05, 0.8, 0.8] : [1.25, 1.08, 0.9]}><sphereGeometry args={[0.52, 32, 24]} /><Mat c={c} r={0.95} /></mesh>}
      {kind === 'bun' && top && <><mesh position={[0, 0.47, -0.06]}><sphereGeometry args={[0.16, 20, 16]} /><Mat c={c} /></mesh><mesh position={[0, 0.36, -0.04]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.1, 0.025, 8, 20]} /><Mat c={shade(c, -0.15)} /></mesh></>}
      {kind === 'ponytail' && <>
        <mesh position={[0, 0.02, -0.45]} rotation={[0.45, 0, 0]}><capsuleGeometry args={[0.1, 0.42, 6, 14]} /><Mat c={c} /></mesh>
        <mesh position={[0, 0.2, -0.4]} rotation={[1.1, 0, 0]}><torusGeometry args={[0.08, 0.025, 8, 18]} /><Mat c="#F0262F" /></mesh>
      </>}
      {(kind === 'long' || kind === 'wavy') && <>
        <mesh position={[0, -0.25, -0.13]} scale={[1.07, 1.55, 0.62]}><sphereGeometry args={[0.42, 28, 20]} /><Mat c={c} /></mesh>
        {([-1, 1] as const).map((s) => <mesh key={s} position={[s * 0.36, -0.22, 0.06]} rotation={[0, 0, s * 0.06]}><capsuleGeometry args={[0.085, 0.42, 6, 12]} /><Mat c={c} /></mesh>)}
        {kind === 'wavy' && ([-1, 1] as const).flatMap((s) => [0, 1, 2].map((i) => <mesh key={`${s}${i}`} position={[s * (0.41 + (i % 2) * 0.03), -0.05 - i * 0.17, 0.08]}><sphereGeometry args={[0.07, 12, 10]} /><Mat c={c} /></mesh>))}
      </>}
      {kind === 'bob' && <>
        {([-1, 1] as const).map((s) => <mesh key={s} position={[s * 0.35, -0.1, 0.02]} scale={[0.15, 0.3, 0.32]}><sphereGeometry args={[1, 20, 14]} /><Mat c={c} /></mesh>)}
        <mesh position={[0, -0.08, -0.18]} scale={[0.46, 0.34, 0.3]}><sphereGeometry args={[1, 24, 16]} /><Mat c={c} /></mesh>
        <mesh position={[0, 0.27, 0.26]} rotation={[0.6, 0, 0]} scale={[0.4, 0.09, 0.15]}><sphereGeometry args={[1, 20, 12]} /><Mat c={c} /></mesh>
      </>}
      {kind === 'mohawk' && top && [0, 1, 2, 3, 4, 5].map((i) => { const a = -0.55 + i * 0.36; return <mesh key={i} position={[0, Math.cos(a) * 0.43, Math.sin(a) * 0.43]} rotation={[a, 0, 0]}><coneGeometry args={[0.075, 0.26, 10]} /><Mat c={c} /></mesh> })}
      {kind === 'spiky' && top && Array.from({ length: 11 }, (_, i) => { const a = (i / 11) * Math.PI * 2, tilt = 0.75; const dir = new THREE.Vector3(Math.cos(a) * Math.sin(tilt), Math.cos(tilt), Math.sin(a) * Math.sin(tilt) - 0.15).normalize(); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); return <mesh key={i} position={dir.clone().multiplyScalar(0.4).toArray()} quaternion={q}><coneGeometry args={[0.08, 0.24, 10]} /><Mat c={c} /></mesh> })}
      {kind === 'spiky' && top && <mesh position={[0, 0.47, 0]}><coneGeometry args={[0.08, 0.24, 10]} /><Mat c={c} /></mesh>}
      {kind === 'pigtails' && ([-1, 1] as const).map((s) => <group key={s}>
        <mesh position={[s * 0.5, -0.05, -0.05]}><sphereGeometry args={[0.15, 18, 14]} /><Mat c={c} /></mesh>
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
export function Character({ cfg }: { cfg: AvatarConfig }) {
  const bw = BUILD[cfg.build as keyof typeof BUILD] ?? 1
  const root = useRef<THREE.Group>(null), lArm = useRef<THREE.Group>(null), rArm = useRef<THREE.Group>(null), head = useRef<THREE.Group>(null), flame = useRef<THREE.Group>(null), cape = useRef<THREE.Mesh>(null)
  const tex = usePattern(cfg)
  const skin = cfg.skin, tc = cfg.topColor, bc = cfg.bottomColor, sc = cfg.shoeColor
  const sleeves: 'none' | 'short' | 'long' = cfg.top === 'tank' || cfg.top === 'dress' ? 'none' : cfg.top === 'tshirt' || cfg.top === 'jersey' ? 'short' : 'long'
  const shoulderX = 0.31 * bw + 0.07
  const hatOn = cfg.hat !== 'none' && cfg.hat !== 'halo' && cfg.hat !== 'headphones' && cfg.hat !== 'cat' && cfg.hat !== 'horns' && cfg.hat !== 'flowers'

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (!root.current || !lArm.current || !rArm.current || !head.current) return
    const p = cfg.pose
    root.current.position.y = p === 'cheer' ? Math.abs(Math.sin(t * 4)) * 0.08 : p === 'dance' ? Math.abs(Math.sin(t * 5)) * 0.05 : Math.sin(t * 1.6) * 0.012
    root.current.rotation.y = p === 'dance' ? Math.sin(t * 2.5) * 0.35 : 0
    head.current.rotation.z = Math.sin(t * 0.9) * 0.04 + (p === 'dance' ? Math.sin(t * 5) * 0.08 : 0)
    head.current.rotation.x = Math.sin(t * 0.7) * 0.03
    let la = 0.12, ra = -0.12
    if (p === 'wave') ra = -2.05 + Math.sin(t * 7) * 0.3
    if (p === 'cheer') { la = 1.95 + Math.sin(t * 8) * 0.12; ra = -1.95 - Math.sin(t * 8) * 0.12 }
    if (p === 'dance') { la = 0.6 + Math.sin(t * 5) * 0.9; ra = -0.6 + Math.sin(t * 5 + Math.PI) * 0.9 }
    if (cfg.hand !== 'none' && p === 'idle') ra = -0.35
    lArm.current.rotation.z = la; rArm.current.rotation.z = ra
    rArm.current.rotation.x = cfg.hand !== 'none' && p === 'idle' ? -0.5 : 0
    if (flame.current) flame.current.scale.y = 0.8 + Math.sin(t * 30) * 0.2
    if (cape.current) cape.current.rotation.x = 0.12 + Math.sin(t * 2) * 0.04
  })

  const legX = 0.13 * bw
  const dress = cfg.top === 'dress'
  const legCover = dress ? (cfg.bottom === 'leggings' ? 'leggings' : 'skin') : cfg.bottom

  return (
    <group ref={root}>
      {/* ayaqqabılar */}
      {([-1, 1] as const).map((s) => <Shoe key={s} x={s * legX} kind={cfg.shoes} color={sc} skin={skin} />)}
      {/* ayaqlar */}
      {([-1, 1] as const).map((s) => (
        <group key={s} position={[s * legX, 0, 0]}>
          {legCover === 'shorts' || legCover === 'skirt' || legCover === 'skin' ? <>
            <mesh position={[0, 0.42, 0]}><capsuleGeometry args={[0.095, 0.55, 6, 14]} /><Mat c={skin} r={0.6} /></mesh>
            {legCover === 'shorts' && <mesh position={[0, 0.75, 0]}><cylinderGeometry args={[0.135, 0.125, 0.32, 18]} /><Mat c={bc} /></mesh>}
          </> : <>
            <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[legCover === 'leggings' ? 0.11 : 0.13, legCover === 'joggers' ? 0.1 : 0.12, 0.78, 18]} /><Mat c={bc} r={legCover === 'jeans' ? 0.95 : 0.8} /></mesh>
            {legCover === 'joggers' && <mesh position={[0, 0.15, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.1, 0.025, 8, 18]} /><Mat c={shade(bc, -0.1)} /></mesh>}
            {legCover === 'joggers' && <mesh position={[s * 0.125, 0.5, 0]}><boxGeometry args={[0.012, 0.7, 0.04]} /><Mat c="#F5F5F7" /></mesh>}
            {legCover === 'jeans' && <mesh position={[0, 0.14, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.122, 0.022, 8, 18]} /><Mat c={shade(bc, 0.15)} /></mesh>}
            {legCover === 'cargo' && <RoundedBox args={[0.1, 0.14, 0.05]} radius={0.015} position={[s * 0.1, 0.6, 0.06]}><Mat c={shade(bc, -0.08)} /></RoundedBox>}
          </>}
        </group>
      ))}
      {/* omba */}
      {!dress && legCover !== 'skin' && legCover !== 'skirt' && <RoundedBox args={[0.56 * bw, 0.26, 0.34]} radius={0.1} position={[0, 0.93, 0]}><Mat c={bc} r={legCover === 'jeans' ? 0.95 : 0.8} /></RoundedBox>}
      {(legCover === 'skirt' || dress) && <mesh position={[0, 0.78, 0]}><cylinderGeometry args={[0.28 * bw, 0.46 * bw, 0.42, 32]} /><Mat c={dress ? tc : bc} /></mesh>}
      {legCover === 'skirt' && !dress && <RoundedBox args={[0.54 * bw, 0.18, 0.32]} radius={0.08} position={[0, 0.98, 0]}><Mat c={bc} /></RoundedBox>}

      {/* gövdə */}
      <RoundedBox args={[0.62 * bw, 0.68, 0.38]} radius={0.15} smoothness={4} position={[0, 1.22, 0]}><Mat c={tc} r={cfg.top === 'jacket' ? 0.55 : 0.85} /></RoundedBox>
      {tex && <mesh position={[0, 1.25, 0.192]}><planeGeometry args={[0.42 * bw, 0.42]} /><meshStandardMaterial map={tex} transparent roughness={0.85} /></mesh>}
      <TopDetails cfg={cfg} bw={bw} />

      {/* qollar */}
      <Arm side={-1} armRef={lArm} cfg={cfg} sleeves={sleeves} shoulderX={shoulderX} /><Arm side={1} armRef={rArm} cfg={cfg} sleeves={sleeves} shoulderX={shoulderX} />

      {/* boyun + boyun aksesuarı */}
      <mesh position={[0, 1.6, 0]}><cylinderGeometry args={[0.09, 0.1, 0.16, 16]} /><Mat c={skin} r={0.6} /></mesh>
      <Neck kind={cfg.neck} color={cfg.neckColor} />
      <Back kind={cfg.back} color={cfg.backColor} bw={bw} flame={flame} cape={cape} />

      {/* baş */}
      <group ref={head}>
        <group position={[0, -HEAD_Y, 0]} />
        <mesh position={[0, HEAD_Y, 0]} scale={[1, 0.95, 0.95]}><sphereGeometry args={[HEAD_R, 48, 32]} /><Mat c={skin} r={0.55} /></mesh>
        {([-1, 1] as const).map((s) => <mesh key={s} position={[s * 0.39, HEAD_Y - 0.02, 0]} scale={[0.6, 1, 0.8]}><sphereGeometry args={[0.085, 16, 12]} /><Mat c={shade(skin, -0.03)} r={0.6} /></mesh>)}
        <mesh position={onFace(0, 1.92, -0.012)}><sphereGeometry args={[0.04, 16, 12]} /><Mat c={shade(skin, -0.04)} r={0.55} /></mesh>
        <Eye x={-0.14} side={-1} kind={cfg.eyes} color={cfg.eyeColor} />
        <Eye x={0.14} side={1} kind={cfg.eyes} color={cfg.eyeColor} />
        <Brows kind={cfg.eyes === 'angry' && cfg.brows === 'soft' ? 'angry' : cfg.brows} color={cfg.hairColor} />
        <Mouth kind={cfg.mouth} />
        {cfg.blush && ([-1, 1] as const).map((s) => <mesh key={s} position={onFace(s * 0.23, 1.89, 0.003)} rotation={faceRot(s * 0.23)}><circleGeometry args={[0.055, 20]} /><meshStandardMaterial color="#FF6B8B" transparent opacity={0.4} /></mesh>)}
        {cfg.freckles && ([-1, 1] as const).flatMap((s) => [[0.2, 1.93], [0.25, 1.9], [0.19, 1.88], [0.24, 1.94]].map(([x, y], i) => <mesh key={`${s}${i}`} position={onFace(s * x, y, 0.004)}><sphereGeometry args={[0.009, 6, 6]} /><Mat c="#8A5A32" /></mesh>))}
        <FacialHair kind={cfg.facial} color={cfg.hairColor} />
        <Hair kind={cfg.hair} color={cfg.hairColor} hat={hatOn} />
        <Glasses kind={cfg.glasses} color={cfg.glassesColor} />
        <Hat kind={cfg.hat} color={cfg.hatColor} />
      </group>
    </group>
  )
}

function Arm({ side, armRef, cfg, sleeves, shoulderX }: { side: 1 | -1; armRef: React.RefObject<THREE.Group | null>; cfg: AvatarConfig; sleeves: 'none' | 'short' | 'long'; shoulderX: number }) {
  const tc = cfg.topColor, skin = cfg.skin
  return (
    <group ref={armRef} position={[side * shoulderX, 1.47, 0]}>
      <mesh position={[side * 0.02, -0.27, 0]}><capsuleGeometry args={[0.085, 0.4, 6, 14]} /><Mat c={sleeves === 'long' ? tc : skin} r={sleeves === 'long' ? 0.85 : 0.6} /></mesh>
      {sleeves === 'short' && <mesh position={[side * 0.015, -0.1, 0]}><cylinderGeometry args={[0.115, 0.105, 0.22, 16]} /><Mat c={tc} /></mesh>}
      {sleeves === 'short' && cfg.top === 'jersey' && <mesh position={[side * 0.015, -0.2, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.107, 0.014, 8, 20]} /><Mat c={cfg.topColor2} /></mesh>}
      {sleeves === 'long' && (cfg.top === 'hoodie' || cfg.top === 'sweater') && <mesh position={[side * 0.02, -0.5, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.085, 0.022, 8, 18]} /><Mat c={cfg.top === 'sweater' ? cfg.topColor2 : shade(tc, -0.08)} /></mesh>}
      <mesh position={[side * 0.025, -0.6, 0]}><sphereGeometry args={[0.09, 18, 14]} /><Mat c={skin} r={0.6} /></mesh>
      {side === 1 && <HandItem kind={cfg.hand} cfg={cfg} />}
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
      <mesh position={[0, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[bw * 1.05, 0.65, 1]}><torusGeometry args={[0.29, 0.04, 10, 36]} /><Mat c={c2} r={0.9} /></mesh>
      <mesh position={[0, 1.22, 0.193]}><boxGeometry args={[0.012, 0.62, 0.01]} /><Mat c="#C9CDD8" m={0.8} r={0.3} /></mesh>
      <mesh position={[-0.17 * bw, 1.36, 0.19]} rotation={[0, 0, 0.6]}><boxGeometry args={[0.05, 0.02, 0.01]} /><Mat c={c2} /></mesh>
    </>
    case 'sweater': return <>
      <mesh position={[0, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[bw * 1.05, 0.65, 1]}><torusGeometry args={[0.29, 0.04, 10, 36]} /><Mat c={c2} r={0.95} /></mesh>
      <mesh position={[0, 1.55, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.13, 0.035, 10, 28]} /><Mat c={c2} r={0.95} /></mesh>
    </>
    case 'shirt': return <>
      {([-1, 1] as const).map((s) => <mesh key={s} position={[s * 0.07, 1.52, 0.15]} rotation={[0.3, 0, s * 0.9]}><coneGeometry args={[0.06, 0.12, 3]} /><Mat c={shade(tc, 0.04)} /></mesh>)}
      <mesh position={[0, 1.48, 0.2]}><boxGeometry args={[0.06, 0.06, 0.03]} /><Mat c={c2} /></mesh>
      <mesh position={[0, 1.27, 0.2]} scale={[1, 1, 0.3]}><coneGeometry args={[0.05, 0.38, 4]} /><Mat c={c2} /></mesh>
    </>
    case 'tank': return <>{([-1, 1] as const).map((s) => <mesh key={s} position={[s * 0.15 * bw, 1.53, 0]}><boxGeometry args={[0.06, 0.05, 0.36]} /><Mat c={tc} /></mesh>)}</>
    case 'dress': return <mesh position={[0, 1.0, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[bw, 0.65, 1]}><torusGeometry args={[0.29, 0.025, 8, 36]} /><Mat c={c2} /></mesh>
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
      {([-1, 1] as const).map((s) => <mesh key={s} position={[s * 0.18 * bw, 1.3, 0.02]} rotation={[Math.PI / 2, 0, 0]} scale={[0.6, 1.1, 1]}><torusGeometry args={[0.2, 0.022, 6, 20, Math.PI]} /><Mat c={shade(color, -0.15)} /></mesh>)}
    </>
    case 'crossbody': return <>
      <mesh position={[0, 1.22, 0]} rotation={[0, 0, 0.75]} scale={[1.05 * bw, 1, 0.68]}><torusGeometry args={[0.38, 0.016, 6, 40]} /><Mat c={shade(color, -0.2)} /></mesh>
      <RoundedBox args={[0.2, 0.15, 0.08]} radius={0.04} position={[0.28 * bw, 0.95, 0.15]}><Mat c={color} r={0.6} /></RoundedBox>
    </>
    case 'tote': return <>
      <RoundedBox args={[0.26, 0.3, 0.06]} radius={0.03} position={[-0.43 * bw, 0.98, 0.04]} rotation={[0, 0, 0.08]}><Mat c={color} r={0.9} /></RoundedBox>
      <mesh position={[-0.42 * bw, 1.2, 0.04]} rotation={[0, 0, 0.08]} scale={[0.8, 2.2, 1]}><torusGeometry args={[0.08, 0.01, 6, 16, Math.PI]} /><Mat c={shade(color, -0.2)} /></mesh>
    </>
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
