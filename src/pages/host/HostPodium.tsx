import { Trophy } from 'lucide-react'
import { t } from '../../i18n/az'
import { Leaderboard } from '../../components/Leaderboard'
import { Podium } from '../../components/Podium'
import { TeamBoard } from '../../components/TeamBoard'
import { TEAMS } from '../../lib/teams'
import type { Game } from '../../types'

export function HostLeaderboard({ game }: { game: Game }) {
  return (
    <div className={`mx-auto grid w-full flex-1 gap-8 p-8 ${game.teamBoard?.length ? 'max-w-7xl grid-cols-[1fr_1.4fr]' : 'max-w-5xl'}`}>
      {(game.teamBoard?.length ?? 0) > 0 && <div><h2 className="mb-4 text-4xl font-black">{t.teamsUi.board}</h2><TeamBoard rows={game.teamBoard!} big /></div>}
      <div className="flex flex-col gap-6">
        <h1 className="flex items-center justify-center gap-4 text-center text-6xl font-black"><Trophy className="h-14 w-14 text-orange-400" />{t.game.leaderboard}</h1>
        <Leaderboard entries={game.leaderboard} big max={8} />
      </div>
    </div>
  )
}

export function HostPodium({ game }: { game: Game }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-end gap-8 p-8">
      <h1 className="text-center text-6xl font-black drop-shadow-lg">{game.title}</h1>
      {(game.teamBoard?.length ?? 0) > 0 && <div className="chip bg-white/20 px-6 py-2 text-3xl font-black text-white">🏆 {t.teamsUi.winner(`${TEAMS[game.teamBoard![0].team].emoji} ${TEAMS[game.teamBoard![0].team].name}`)}</div>}
      <Podium entries={game.leaderboard} />
    </div>
  )
}
