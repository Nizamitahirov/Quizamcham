import type { ReactNode } from 'react'
import { useOutletContext } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { t } from '../i18n/az'
import type { AdminState } from '../firebase/auth'
import type { PermKey } from '../lib/roles'

/** Səhifə səviyyəli giriş: istifadəçinin effektiv icazəsi yoxdursa izah göstərilir (əsl yoxlama Rules-dadır). */
export function OwnerOnly({ children, perm = 'settings' }: { children: ReactNode; perm?: PermKey }) {
  const { perms } = useOutletContext<AdminState>()
  if (perms[perm]) return <>{children}</>
  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      <p className="card flex items-center gap-3 p-6 text-sm font-semibold text-amber-300"><ShieldAlert className="h-5 w-5 shrink-0" />{t.access.noPerm}</p>
    </div>
  )
}
