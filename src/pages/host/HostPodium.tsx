import { t } from '../../i18n/az'
import { Leaderboard } from '../../components/Leaderboard'
import { Podium } from '../../components/Podium'
import type { Game } from '../../types'

export function HostLeaderboard({ game }: { game: Game }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-8">
      <h1 className="text-center text-6xl">{t.game.leaderboard}</h1>
      <Leaderboard entries={game.leaderboard} big max={10} />
    </div>
  )
}

export function HostPodium({ game }: { game: Game }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-end gap-6 p-8">
      <h1 className="text-6xl">🏆 {game.title}</h1>
      <Podium entries={game.leaderboard} />
    </div>
  )
}
