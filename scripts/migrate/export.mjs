/**
 * Firebase → Jabr köçürmə, 1-ci addım: Firestore sənədləri və giriş hesabları NDJSON kimi stdout-a.
 *   GOOGLE_APPLICATION_CREDENTIALS=sa.json node scripts/migrate/export.mjs > dump.ndjson
 * Sətir növləri: {"k":"doc","path","data"} | {"k":"user",...} | {"k":"meta",...}
 * Diqqət: fayl şəxsi məlumatlar və şifrə hash-ləri saxlayır — repoya/artefakta YÜKLƏMƏYİN, istifadədən sonra silin.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, Timestamp, GeoPoint, DocumentReference } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID ?? 'birsual' })
const db = getFirestore()
const out = (o) => process.stdout.write(JSON.stringify(o) + '\n')

function wire(v) {
  if (v === null || v === undefined) return null
  if (v instanceof Timestamp) return { __t: v.toMillis() }
  if (v instanceof Date) return { __t: v.getTime() }
  if (v instanceof GeoPoint) return { latitude: v.latitude, longitude: v.longitude }
  if (v instanceof DocumentReference) return v.path
  if (Buffer.isBuffer(v) || v instanceof Uint8Array) return Buffer.from(v).toString('base64')
  if (Array.isArray(v)) return v.map(wire)
  if (typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, wire(x)]))
  if (typeof v === 'number' && !Number.isFinite(v)) return null
  return v
}

let docs = 0
async function walk(col) {
  // listDocuments: alt kolleksiyası olan, amma özü olmayan sənədlər də daxil
  const refs = await col.listDocuments()
  for (let i = 0; i < refs.length; i += 300) {
    const chunk = refs.slice(i, i + 300)
    const snaps = await db.getAll(...chunk)
    for (const s of snaps) if (s.exists) { out({ k: 'doc', path: s.ref.path, data: wire(s.data()) }); docs++ }
    for (const r of chunk) for (const sub of await r.listCollections()) await walk(sub)
  }
}
for (const c of await db.listCollections()) await walk(c)

let users = 0, withHash = 0, skipped = 0
let token
do {
  const page = await getAuth().listUsers(1000, token)
  for (const u of page.users) {
    const providers = u.providerData.map((p) => p.providerId)
    if (!u.email && providers.length === 0) { skipped++; continue } // anonim oyunçular — köçürülmür (sənədlər qalır)
    if (u.passwordHash) withHash++
    out({
      k: 'user', uid: u.uid, email: u.email?.toLowerCase() ?? null, providers, disabled: u.disabled,
      displayName: u.displayName ?? null, photoURL: u.photoURL ?? null,
      passwordHash: u.passwordHash ?? null, passwordSalt: u.passwordSalt ?? null,
      googleSub: u.providerData.find((p) => p.providerId === 'google.com')?.uid ?? null,
      createdAt: u.metadata.creationTime ? Date.parse(u.metadata.creationTime) : null,
    })
    users++
  }
  token = page.pageToken
} while (token)
out({ k: 'meta', docs, users, withHash, skippedAnonymous: skipped, at: Date.now() })
console.error(`export: ${docs} sənəd, ${users} istifadəçi (${withHash} şifrə hash-i ilə), ${skipped} anonim buraxıldı`)
