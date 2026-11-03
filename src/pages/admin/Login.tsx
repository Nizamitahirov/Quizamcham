import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { adminLogin, useAdmin } from '../../firebase/auth'
import { t } from '../../i18n/az'
import { FullScreen, Page, Spinner } from '../../components/ui'
import { FloatingShapes } from '../../components/FloatingShapes'

export default function Login() {
  const nav = useNavigate()
  const admin = useAdmin()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  if (admin.loading) return <FullScreen><div className="m-auto"><Spinner /></div></FullScreen>
  if (admin.isAdmin) return <Navigate to="/admin" replace />
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await adminLogin(email, pw)
      nav('/admin')
    } catch (ex) {
      setErr((ex as Error).message === 'not-admin' ? t.admin.notAdmin : t.admin.badCreds)
    } finally {
      setBusy(false)
    }
  }
  return (
    <FullScreen>
      <FloatingShapes count={10} />
      <Page>
        <form onSubmit={submit} className="card m-auto flex w-[min(420px,92vw)] flex-col gap-4 p-6">
          <div className="text-center text-5xl">🎯</div>
          <h1 className="text-center text-2xl">{t.admin.login}</h1>
          <div>
            <label className="label" htmlFor="em">{t.admin.email}</label>
            <input id="em" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="pw">{t.admin.password}</label>
            <input id="pw" className="input" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
          </div>
          {err && <p className="text-center font-extrabold text-red-600" role="alert">{err}</p>}
          <button className="btn btn-primary text-lg" disabled={busy}>{busy ? t.admin.signingIn : t.admin.signIn}</button>
        </form>
      </Page>
    </FullScreen>
  )
}
