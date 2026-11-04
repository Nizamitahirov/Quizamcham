import type { ReactNode } from 'react'
import { useOutletContext } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { t } from '../i18n/az'
import type { AdminState } from '../firebase/auth'

/** Platforma səviyyəli ayarlar yalnız sahibə açıqdır. */
export function OwnerOnly({ children }: { children: ReactNode }) {
  const { role } = useOutletContext<AdminState>()
  if (role === 'owner') return <>{children}</>
  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      <p className="card flex items-center gap-3 p-6 text-sm font-semibold text-amber-800"><ShieldAlert className="h-5 w-5 shrink-0" />{t.admin.ownerOnlyPage}</p>
    </div>
  )
}
