import { create } from 'zustand'
import { ACTIVE_GAME_KEY } from '../lib/gameEngine'

interface Session { gameId: string | null; setGame: (id: string | null) => void }

const read = () => { try { return localStorage.getItem(ACTIVE_GAME_KEY) } catch { return null } }

export const useSession = create<Session>((set) => ({
  gameId: read(),
  setGame: (id) => {
    try { if (id) localStorage.setItem(ACTIVE_GAME_KEY, id); else localStorage.removeItem(ACTIVE_GAME_KEY) } catch { /* noop */ }
    set({ gameId: id })
  },
}))
