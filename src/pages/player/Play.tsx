import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { ensureAnonymous } from '../../firebase/auth'
import { FullScreen, Spinner } from '../../components/ui'

/** Daimi QR: /play → ən son aktiv oyunun qoşulma səhifəsi. */
export default function Play() {
  const [to, setTo] = useState<string | null>(null)
  useEffect(() => {
    void ensureAnonymous()
      .then(() => getDoc(doc(db, 'settings', 'current')))
      .then((s) => setTo(s.exists() && s.get('pin') ? `/join?pin=${s.get('pin')}` : '/join'))
      .catch(() => setTo('/join'))
  }, [])
  if (to) return <Navigate to={to} replace />
  return <FullScreen><div className="m-auto"><Spinner /></div></FullScreen>
}
