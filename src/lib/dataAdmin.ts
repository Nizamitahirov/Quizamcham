import { collection, deleteDoc, getDocs, limit, orderBy, query, Timestamp, where, writeBatch } from 'firebase/firestore'
import { db } from '../firebase/config'
import { deleteGame, loadQuiz, listQuizzes, quizToJson } from '../firebase/db'

export async function oldGames(days: number) {
  const cutoff = Timestamp.fromMillis(Date.now() - days * 86_400_000)
  const s = await getDocs(query(collection(db, 'games'), where('createdAt', '<', cutoff)))
  return s.docs.map((d) => ({ id: d.id, pin: d.get('pin') as string }))
}

export async function cleanupGames(days: number, onProgress?: (n: number) => void) {
  const list = await oldGames(days)
  let n = 0
  for (const g of list) {
    await deleteGame(g.id, g.pin).catch(() => {})
    onProgress?.(++n)
  }
  return n
}

/** Bütün quizlər (suallarla) + oyunların xülasəsi — əl ilə ehtiyat nüsxə. */
export async function exportAll() {
  const quizzes = await listQuizzes()
  const full = []
  for (const q of quizzes) { const d = await loadQuiz(q.id); if (d) full.push({ id: q.id, ...quizToJson(d.quiz, d.questions) }) }
  const games = (await getDocs(query(collection(db, 'games'), orderBy('createdAt', 'desc')))).docs.map((d) => {
    const g = d.data()
    return { id: d.id, title: g.title, pin: g.pin, createdAt: g.createdAt?.toDate?.().toISOString?.() ?? null, playerCount: g.playerCount, phase: g.phase, stats: g.stats ?? null, leaderboard: g.leaderboard ?? [] }
  })
  return { exportedAt: new Date().toISOString(), quizzes: full, games }
}

export async function listErrors(max = 50) {
  const s = await getDocs(query(collection(db, 'errors'), orderBy('at', 'desc'), limit(max)))
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as { message: string; url: string; context: string; ua: string; at?: Timestamp }) }))
}
export async function clearErrors() {
  const s = await getDocs(collection(db, 'errors'))
  const b = writeBatch(db)
  s.docs.slice(0, 450).forEach((d) => b.delete(d.ref))
  await b.commit()
}
export { deleteDoc }
