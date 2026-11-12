import { useEffect, useState } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { ensureAnonymous } from '../../firebase/auth'
import { normQr, resolvePointer } from '../../lib/permQr'
import { FullScreen, Spinner } from '../../components/ui'

/**
 * Daimi QR:
 *   /q/<kod>           → həmin təlimçinin hazırda açıq canlı oyunu (yeni, uid görünmür)
 *   /play?t=<uid>      → köhnə çap olunmuş QR-lar (təlimçi QR-ı yeniləyibsə işləmir)
 *   /play              → komanda üzrə ümumi QR
 * Oyun həqiqətən açıq deyilsə "aktiv oyun yoxdur".
 */
export default function Play() {
  const [params] = useSearchParams()
  const { code = '' } = useParams()
  const [to, setTo] = useState<string | null>(null)
  useEffect(() => {
    const path = code ? `qr/${normQr(code)}` : params.get('t') ? `settings/play_${params.get('t')}` : 'settings/current'
    void ensureAnonymous()
      .then(() => resolvePointer(path))
      .then((pin) => setTo(pin ? `/join?pin=${pin}` : '/join?none=1'))
      .catch(() => setTo('/join?none=1'))
  }, [params, code])
  if (to) return <Navigate to={to} replace />
  return <FullScreen><div className="m-auto"><Spinner /></div></FullScreen>
}
