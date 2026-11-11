import { motion } from 'framer-motion'
import { Divide, Shield, Zap } from 'lucide-react'
import { t } from '../../i18n/az'
import { audio } from '../../audio/AudioEngine'
import { activatePower, cancelPower } from '../../lib/gameEngine'
import type { Game, Player, PowerType, PublicQuestion } from '../../types'

export const POWERS: { type: PowerType; icon: typeof Zap; label: string; desc: string; bg: string }[] = [
  { type: 'fifty', icon: Divide, label: t.power.fifty, desc: t.power.fiftyDesc, bg: 'linear-gradient(135deg,#2563EB,#7C3AED)' },
  { type: 'double', icon: Zap, label: t.power.double, desc: t.power.doubleDesc, bg: 'var(--grad)' },
  { type: 'shield', icon: Shield, label: t.power.shield, desc: t.power.shieldDesc, bg: 'linear-gradient(135deg,#059669,#0EA5E9)' },
]

export function PowerBar({ game, player, disabled, q: qProp, qi: qiProp }: { game: Game; player: Player; disabled: boolean; q?: PublicQuestion | null; qi?: number }) {
  const q = qProp ?? game.currentQuestion
  const qIndex = qiProp ?? game.questionIndex
  if (!q || game.settings.powerUps === false || !['single', 'multi', 'truefalse', 'type', 'order', 'slider'].includes(q.type)) return null
  const active = player.power?.q === qIndex ? player.power.type : null
  const fiftyApplied = player.fiftyHide?.q === qIndex // variantlar artıq gizlədilib — geri qaytarmaq olmaz
  const fiftyOk = ['single', 'multi'].includes(q.type) && q.options.length >= 3
  const use = (type: PowerType) => { audio.pop(); void activatePower(game.id, player.uid, qIndex, type).catch(() => {}) }
  const cancel = () => { audio.pop(); void cancelPower(game.id, player.uid).catch(() => {}) }
  const cancellable = !disabled && !!active && !fiftyApplied
  return (
    <div>
      <div className="grid grid-cols-3 gap-2" aria-label={t.power.title}>
        {POWERS.map((p) => {
          const left = player.powerups?.[p.type] ?? 0
          const isActive = active === p.type || (p.type === 'fifty' && fiftyApplied)
          // seçilmiş gücə yenidən toxunmaq → ləğv; 2x ↔ Qalxan arasında dəyişmək olar; 50/50 yalnız heç nə seçilməyibsə
          const canCancel = isActive && cancellable
          const canUse = !disabled && !isActive && left > 0 && (p.type !== 'fifty' || fiftyOk)
            && (!active || (active !== 'fifty' && p.type !== 'fifty'))
          const enabled = canCancel || canUse
          return (
            <motion.button key={p.type} type="button" whileTap={enabled ? { scale: 0.9 } : undefined} disabled={!enabled && !isActive}
              onClick={() => { if (canCancel) cancel(); else if (canUse) use(p.type) }}
              title={canCancel ? t.power.tapToCancel : p.desc} aria-pressed={isActive}
              className={`relative flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-bold transition disabled:opacity-35 ${isActive ? 'border-transparent text-white' : 'border-white/12 bg-white/[.06] text-white'}`}
              style={isActive ? { background: p.bg, boxShadow: '0 0 20px -4px rgba(255,138,26,.7)' } : undefined}>
              <p.icon className="h-4 w-4" />{p.label}
              {!isActive && <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-black text-ink">{left}</span>}
              {isActive && <span className="text-[10px] opacity-90">{canCancel ? '✕' : '✓'}</span>}
            </motion.button>
          )
        })}
      </div>
      {cancellable && <p className="mt-1.5 text-center text-[11px] text-white/60">{t.power.tapToCancel}</p>}
    </div>
  )
}

