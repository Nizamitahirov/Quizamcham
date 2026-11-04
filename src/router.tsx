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
          { index: true, element: S(<Dashboard />), errorElement: <RouteError /> },
          { path: 'quizzes', element: S(<QuizList />), errorElement: <RouteError /> },
          { path: 'quiz/:quizId', element: S(<QuizEditor />), errorElement: <RouteError /> },
          { path: 'games', element: S(<Games />), errorElement: <RouteError /> },
          { path: 'games/:gameId', element: S(<GameReport />), errorElement: <RouteError /> },
          { path: 'settings', element: S(<Settings />), errorElement: <RouteError /> },
          { path: 'profile', element: S(<Profile />), errorElement: <RouteError /> },
          { path: 'sounds', element: S(<Sounds />), errorElement: <RouteError /> },
          { path: 'team', element: S(<Team />), errorElement: <RouteError /> },
        ],
      },
      { path: '*', element: S(<NotFound />) },
    ],
  },
])
