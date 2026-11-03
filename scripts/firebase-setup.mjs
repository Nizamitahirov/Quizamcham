#!/usr/bin/env node
/**
 * Quizamcham Firebase qurulumu (Admin SDK ilə).
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/sa.json node scripts/firebase-setup.mjs [--rules] [--admin email password] [--seed]
 *
 * --rules   firestore.rules faylını publish edir
 * --admin   e-poçt/şifrə ilə istifadəçi yaradır (və ya mövcudunu tapır) və admins/{uid} sənədini yazır
 * --seed    seed/ai-pretest.json quizini (əgər yoxdursa) admin adına idxal edir
 */
import { readFileSync } from 'node:fs'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getSecurityRules } from 'firebase-admin/security-rules'

const args = process.argv.slice(2)
const projectId = process.env.FIREBASE_PROJECT_ID || JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8')).project_id
initializeApp({ credential: applicationDefault(), projectId })
const db = getFirestore()
db.settings({ ignoreUndefinedProperties: true })

if (args.includes('--rules')) {
  const src = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')
  const rs = await getSecurityRules().releaseFirestoreRulesetFromSource(src)
  console.log('✓ Firestore rules publish edildi:', rs.name)
}

let adminUid = null
const ai = args.indexOf('--admin')
if (ai >= 0) {
  const email = args[ai + 1]
  const password = args[ai + 2]
  const auth = getAuth()
  let user
  try {
    user = await auth.getUserByEmail(email)
    if (password) await auth.updateUser(user.uid, { password })
    console.log('• Mövcud istifadəçi:', user.uid)
  } catch {
    user = await auth.createUser({ email, password, emailVerified: true })
    console.log('✓ İstifadəçi yaradıldı:', user.uid)
  }
  adminUid = user.uid
  await db.doc(`admins/${user.uid}`).set({ email, createdAt: FieldValue.serverTimestamp() }, { merge: true })
  console.log('✓ admins/' + user.uid + ' yazıldı')
}

if (args.includes('--seed')) {
  const seed = JSON.parse(readFileSync(new URL('../seed/ai-pretest.json', import.meta.url), 'utf8'))
  const exists = await db.collection('quizzes').where('title', '==', seed.title).limit(1).get()
  if (!exists.empty) console.log('• Seed quiz artıq var:', exists.docs[0].id)
  else {
    const ref = db.collection('quizzes').doc()
    const batch = db.batch()
    const ids = seed.questions.map((_, i) => `q${i + 1}`)
    const defaults = { mode: 'host', scoring: 'speed', defaultTime: 45, streakBonus: true, shuffleQuestions: false, shuffleOptions: true, showCorrect: true, leaderboardEvery: 1, lateJoin: true, music: { on: true, volume: 60, theme: 'energetic' }, nameFilter: true, maxPlayers: 100 }
    batch.set(ref, {
      title: seed.title, description: seed.description ?? '', coverEmoji: seed.coverEmoji ?? '🤖', coverColor: seed.coverColor ?? '#E4202E',
      settings: { ...defaults, ...seed.settings, music: { ...defaults.music, ...(seed.settings?.music ?? {}) } },
      questionOrder: ids, ownerUid: adminUid ?? '', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    })
    seed.questions.forEach((q, i) => batch.set(ref.collection('questions').doc(ids[i]), { options: [], correct: [], ...(q.type === 'type' ? { softMatch: true } : {}), ...q, id: ids[i] }))
    await batch.commit()
    console.log('✓ Seed quiz idxal edildi:', ref.id)
  }
}
