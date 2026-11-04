import { useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { ensureAnonymous } from '../../firebase/auth'
import { FullScreen, Spinner } from '../../components/ui'

/** Daimi QR: /play → ən son aktiv oyun; /play?t=<təlimçi uid> → həmin təlimçinin aktiv oyunu. */
export default function Play() {
  const [params] = useSearchParams()
  const [to, setTo] = useState<string | null>(null)
  useEffect(() => {
    const key = params.get('t') ? `play_${params.get('t')}` : 'current'
    void ensureAnonymous()
      .then(() => getDoc(doc(db, 'settings', key)))
      .then((s) => setTo(s.exists() && s.get('pin') ? `/join?pin=${s.get('pin')}` : '/join?none=1'))
      .catch(() => setTo('/join?none=1'))
  }, [params])
  if (to) return <Navigate to={to} replace />
  return <FullScreen><div className="m-auto"><Spinner /></div></FullScreen>
}
