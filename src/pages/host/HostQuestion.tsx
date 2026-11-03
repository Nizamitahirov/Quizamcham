import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { t } from '../../i18n/az'
import { AnswerTile, TILE_COLORS, Shape } from '../../components/AnswerTile'
import { TimerRing } from '../../components/TimerRing'
import { Avatar } from '../../components/Avatar'
import type { HostCtx } from './HostGame'

const fitText = (s: string) => (s.length > 160 ? 'text-4xl' : s.length > 90 ? 'text-5xl' : 'text-6xl')

export function HostQuestion({ game, players, answered }: HostCtx) {
  const q = game.currentQuestion
  if (!q) return null
  if (q.type === 'slide') {
    return (
      <div className="m-auto flex max-w-6xl flex-col items-center gap-8 p-10 text-center">
        <h1 className="text-7xl">{q.text}</h1>
        {q.imageUrl && <img src={q.imageUrl} alt="" className="max-h-[45vh] rounded-3xl object-contain" />}
        {q.body && <p className="text-4xl leading-snug opacity-90">{q.body}</p>}
      </div>
    )
  }
  const hasTiles = ['single', 'multi', 'truefalse', 'poll', 'order'].includes(q.type)
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-8">
      <div className="flex items-start gap-8">
        <div className="flex-1">
          <div className="font-display mb-2 text-2xl opacity-70">{t.game.questionOf(game.questionIndex + 1, game.totalQuestions)} · {t.types[q.type]}</div>
          <h1 className={`${fitText(q.text)} leading-tight`}>{q.text}</h1>
        </div>
        <TimerRing endsAt={game.questionEndsAt} total={q.timeLimit} pausedMs={game.pausedRemainingMs} size={170} />
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center gap-8">
        {q.imageUrl && <img src={q.imageUrl} alt="" className="max-h-full max-w-[40%] rounded-3xl object-contain shadow-2xl" />}
        <div className="flex flex-col items-center gap-4">
          <motion.div key={answered.size} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="font-display text-[9rem] leading-none">{answered.size}</motion.div>
          <div className="text-3xl opacity-80">{t.host.answered(answered.size, players.length)}</div>
          <div className="flex max-w-3xl flex-wrap justify-center gap-1">
            {players.map((p) => (
              <motion.span key={p.uid} animate={{ opacity: answered.has(p.uid) ? 1 : 0.2, scale: answered.has(p.uid) ? 1 : 0.85 }}>
                <Avatar avatar={p.avatar} size={36} />
              </motion.span>
            ))}
          </div>
        </div>
      </div>
      {hasTiles && q.type !== 'order' && (
        <div className={`grid gap-4 ${q.options.length <= 2 ? 'grid-cols-2' : q.options.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {q.options.map((o, i) => <AnswerTile key={o.id} index={i} text={o.text} big disabled />)}
        </div>
      )}
      {q.type === 'order' && (
        <div className="grid grid-cols-5 gap-4">
          {q.options.map((o, i) => <AnswerTile key={o.id} index={i} text={o.text} disabled />)}
        </div>
      )}
      {q.type === 'slider' && q.slider && (
        <div className="font-display text-center text-4xl opacity-80">{q.slider.min} ⟷ {q.slider.max}</div>
      )}
    </div>
  )
}

const CLOUD_COLORS = ['#FFD166', '#93C5FD', '#FCA5A5', '#86EFAC', '#C4B5FD', '#F9A8D4']

function WordCloud({ texts }: { texts: string[] }) {
  const words = useMemo(() => {
    const m = new Map<string, number>()
    texts.forEach((x) => { const k = x.trim().toLocaleLowerCase('az-AZ'); if (k) m.set(k, (m.get(k) ?? 0) + 1) })
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60)
  }, [texts])
  const max = words[0]?.[1] ?? 1
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 p-6">
      {words.map(([w, n], i) => (
        <motion.span key={w} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.03 }} className="font-display" style={{ fontSize: `${1.6 + (n / max) * 4.4}rem`, color: CLOUD_COLORS[i % CLOUD_COLORS.length] }}>
          {w}
        </motion.span>
      ))}
    </div>
  )
}

export function HostReveal({ game, questions }: HostCtx) {
  const q = game.currentQuestion
  const r = game.reveal
  const full = questions[game.questionIndex]
  if (!q || !r) return null
  const total = Math.max(1, r.answeredCount)
  const showCorrect = game.settings.showCorrect !== false
  const isChoice = ['single', 'multi', 'truefalse', 'poll'].includes(q.type)
  const maxCount = Math.max(1, ...Object.values(r.distribution))
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-8">
      <h1 className={`${fitText(q.text)} leading-tight`}>{q.text}</h1>
      <div className="text-2xl opacity-70">{t.host.answered(r.answeredCount, game.playerCount)}</div>
      {isChoice && (
        <div className="flex min-h-0 flex-1 items-end justify-center gap-6 px-10">
          {q.options.map((o, i) => {
            const n = r.distribution[o.id] ?? 0
            const ok = r.correct.includes(o.id)
            const dim = q.type !== 'poll' && showCorrect && !ok
            return (
              <div key={o.id} className="flex h-full max-w-72 flex-1 flex-col items-center justify-end gap-3" style={{ opacity: dim ? 0.35 : 1 }}>
                <div className="font-display text-5xl">{n}</div>
                <motion.div initial={{ height: 0 }} animate={{ height: `${(n / maxCount) * 100}%` }} transition={{ duration: 0.9, ease: 'easeOut' }} className="w-full rounded-t-2xl" style={{ background: TILE_COLORS[i % 6], minHeight: 12 }} />
                <div className="flex w-full items-center gap-2 rounded-2xl p-3 text-2xl font-extrabold" style={{ background: TILE_COLORS[i % 6] }}>
                  <Shape i={i} size={30} /><span className="min-w-0 flex-1 truncate">{o.text}</span>{ok && showCorrect && q.type !== 'poll' && <span>✅</span>}
                </div>
                {q.type === 'poll' && <div className="text-2xl">{Math.round((n / total) * 100)}%</div>}
              </div>
            )
          })}
        </div>
      )}
      {q.type === 'type' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          {showCorrect && <div className="rounded-3xl bg-green-600 px-10 py-6 text-center"><div className="text-2xl opacity-90">{t.game.acceptedAnswers}</div><div className="font-display text-6xl">{(r.accepted ?? []).filter(Boolean).join(' · ')}</div></div>}
          <div className="flex flex-wrap justify-center gap-3">
            {Object.entries(r.distribution).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => (
              <span key={k} className="rounded-2xl bg-white/15 px-5 py-2 text-3xl">{k} <b className="opacity-70">×{n}</b></span>
            ))}
          </div>
        </div>
      )}
      {q.type === 'slider' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div className="text-3xl opacity-80">{t.game.correctAnswer}</div>
          <div className="font-display rounded-3xl bg-green-600 px-12 py-6 text-8xl">{r.sliderAnswer}</div>
          {full?.slider?.tolerance ? <div className="text-2xl opacity-70">± {full.slider.tolerance}</div> : null}
        </div>
      )}
      {q.type === 'order' && (
        <ol className="m-auto flex flex-col gap-3">
          {r.correct.map((id, k) => {
            const idx = q.options.findIndex((o) => o.id === id)
            return <motion.li key={id} initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: k * 0.2 }} className="flex items-center gap-4 rounded-2xl px-6 py-3 text-4xl font-extrabold" style={{ background: TILE_COLORS[idx % 6] }}><span className="font-display">{k + 1}</span>{q.options[idx]?.text}</motion.li>
          })}
        </ol>
      )}
      {q.type === 'wordcloud' && <div className="flex-1 overflow-auto"><WordCloud texts={r.texts ?? []} /></div>}
      {q.type === 'open' && (
        <div className="grid flex-1 grid-cols-4 content-start gap-4 overflow-auto">
          {(r.texts ?? []).map((x, i) => (
            <motion.div key={i} initial={{ scale: 0, rotate: -5 }} animate={{ scale: 1, rotate: (i % 3) - 1 }} transition={{ delay: i * 0.04 }} className="rounded-2xl p-4 text-2xl font-bold text-ink shadow-xl" style={{ background: ['#FEF08A', '#BBF7D0', '#BFDBFE', '#FBCFE8'][i % 4] }}>{x}</motion.div>
          ))}
          {(r.texts ?? []).length === 0 && <p className="col-span-4 text-center text-3xl opacity-70">{t.host.nobodyAnswered}</p>}
        </div>
      )}
      {r.explanation && <div className="rounded-3xl bg-white/12 p-5 text-3xl" style={{ background: 'rgba(255,255,255,.12)' }}>💡 {r.explanation}</div>}
    </div>
  )
}
