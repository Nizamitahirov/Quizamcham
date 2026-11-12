import { useEffect, useState } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { t } from '../i18n/az'
import { integrityQuery } from '../lib/gameEngine'
import { FLAG_KINDS, flagSevere, flagTotal, type FlagCounts, type FlagEvent } from '../lib/integrity'

export interface IntegrityRow { uid: string; name: string; counts: FlagCounts; events: FlagEvent[] }

/** Oyunun dürüstlük qeydləri (canlı abunə; yalnız host oxuya bilir). */
export function useIntegrityRows(gameId: string | undefined, enabled = true) {
  const [rows, setRows] = useState<IntegrityRow[]>([])
  useEffect(() => {
    if (!gameId || !enabled) return
    return onSnapshot(integrityQuery(gameId), (s) => setRows(s.docs.map((d) => d.data() as IntegrityRow).filter((r) => flagTotal(r.counts) > 0)
      .sort((a, b) => flagSevere(b.counts) - flagSevere(a.counts) || flagTotal(b.counts) - flagTotal(a.counts))), () => setRows([]))
  }, [gameId, enabled])
  return rows
}

/** Cədvəl: hər iştirakçı üzrə hadisə sayları + son hadisələr (sual nömrəsi ilə). */
export function IntegrityTable({ rows, nameOf }: { rows: IntegrityRow[]; nameOf?: (uid: string) => string | undefined }) {
  const I = t.integrity
  if (!rows.length) return <p className="flex items-center gap-2 px-5 py-6 text-sm text-muted"><ShieldCheck className="h-4 w-4 text-emerald-300" />{I.none}</p>
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead><tr><th>{I.player}</th>{FLAG_KINDS.map((k) => <th key={k} className="text-center">{I.kinds[k]}</th>)}<th>{I.timeline}</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.uid}>
              <td className="font-semibold"><span className="flex items-center gap-2">{flagSevere(r.counts) > 0 && <ShieldAlert className="h-4 w-4 shrink-0 text-amber-300" />}{nameOf?.(r.uid) ?? r.name ?? '—'}</span></td>
              {FLAG_KINDS.map((k) => <td key={k} className={`text-center tabular ${(r.counts[k] ?? 0) > 0 ? 'font-bold text-amber-300' : 'text-muted'}`}>{r.counts[k] ?? 0}</td>)}
              <td><div className="flex max-w-xs flex-wrap gap-1">{(r.events ?? []).slice(-6).map((e, i) => <span key={i} className="chip chip-muted" title={new Date(e.at).toLocaleTimeString()}>{I.q(e.q + 1)} · {I.kinds[e.k]}</span>)}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
