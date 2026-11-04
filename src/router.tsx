import { createBrowserRouter } from 'react-router-dom'
import { lazy, Suspense, type ReactNode } from 'react'
import App from './App'
import { Spinner, RouteError } from './components/ui'

const Home = lazy(() => import('./pages/Home'))
const Join = lazy(() => import('./pages/player/Join'))
const Play = lazy(() => import('./pages/player/Play'))
const PlayerGame = lazy(() => import('./pages/player/PlayerGame'))
const HostGame = lazy(() => import('./pages/host/HostGame'))
const Login = lazy(() => import('./pages/admin/Login'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const QuizList = lazy(() => import('./pages/admin/QuizList'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const Profile = lazy(() => import('./pages/admin/Profile'))
const Sounds = lazy(() => import('./pages/admin/Sounds'))
const QuizEditor = lazy(() => import('./pages/admin/QuizEditor'))
const Games = lazy(() => import('./pages/admin/Games'))
const GameReport = lazy(() => import('./pages/admin/GameReport'))
const Settings = lazy(() => import('./pages/admin/Settings'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Privacy = lazy(() => import('./pages/Privacy'))
const Team = lazy(() => import('./pages/admin/Team'))

const S = (el: ReactNode) => <Suspense fallback={<div className="flex min-h-dvh items-center justify-center bg-night"><Spinner /></div>}>{el}</Suspense>

export const router = createBrowserRouter([
  {
    element: <App />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: S(<Home />) },
      { path: '/join', element: S(<Join />) },
      { path: '/privacy', element: S(<Privacy />) },
      { path: '/play', element: S(<Play />) },
      { path: '/g/:gameId', element: S(<PlayerGame />) },
      { path: '/host/:gameId', element: S(<HostGame />) },
      { path: '/admin/login', element: S(<Login />) },
      {
        path: '/admin',
        element: S(<AdminLayout />),
        children: [
          { index: true, element: S(<Dashboard />) },
          { path: 'quizzes', element: S(<QuizList />) },
          { path: 'quiz/:quizId', element: S(<QuizEditor />) },
          { path: 'games', element: S(<Games />) },
          { path: 'games/:gameId', element: S(<GameReport />) },
          { path: 'settings', element: S(<Settings />) },
          { path: 'profile', element: S(<Profile />) },
          { path: 'sounds', element: S(<Sounds />) },
          { path: 'team', element: S(<Team />) },
        ],
      },
      { path: '*', element: S(<NotFound />) },
    ],
  },
])
