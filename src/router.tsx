import { createBrowserRouter } from 'react-router-dom'
import { lazy, Suspense, type ReactNode } from 'react'
import App from './App'
import { OwnerOnly } from './components/OwnerOnly'
import { Spinner, RouteError } from './components/ui'

const Home = lazy(() => import('./pages/Home'))
const Join = lazy(() => import('./pages/player/Join'))
const Play = lazy(() => import('./pages/player/Play'))
const PlayerGame = lazy(() => import('./pages/player/PlayerGame'))
const HostGame = lazy(() => import('./pages/host/HostGame'))
const Login = lazy(() => import('./pages/admin/Login'))
const ResetPassword = lazy(() => import('./pages/account/ResetPassword'))
const Classes = lazy(() => import('./pages/admin/Classes'))
const ClassDetail = lazy(() => import('./pages/admin/Classes').then((m) => ({ default: m.ClassDetail })))
const Courses = lazy(() => import('./pages/admin/Courses'))
const CoursePage = lazy(() => import('./pages/account/CoursePage'))
const Flashcards = lazy(() => import('./pages/account/Flashcards'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const QuizList = lazy(() => import('./pages/admin/QuizList'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const Profile = lazy(() => import('./pages/admin/Profile'))
const Sounds = lazy(() => import('./pages/admin/Sounds'))
const QuizEditor = lazy(() => import('./pages/admin/QuizEditor'))
const AvatarStudio = lazy(() => import('./pages/account/AvatarStudio'))
const Games = lazy(() => import('./pages/admin/Games'))
const GameReport = lazy(() => import('./pages/admin/GameReport'))
const Settings = lazy(() => import('./pages/admin/Settings'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Privacy = lazy(() => import('./pages/Privacy'))
const Team = lazy(() => import('./pages/admin/Team'))
const Logs = lazy(() => import('./pages/admin/Logs'))
const Console = lazy(() => import('./pages/admin/Console'))
const OrgTeam = lazy(() => import('./pages/admin/OrgTeam'))
const Start = lazy(() => import('./pages/account/Start'))
const Onboarding = lazy(() => import('./pages/account/Onboarding'))
const Learn = lazy(() => import('./pages/account/Learn'))
const Practice = lazy(() => import('./pages/account/Practice'))
const Pricing = lazy(() => import('./pages/account/Pricing'))
const Account = lazy(() => import('./pages/account/Account'))
const Analytics = lazy(() => import('./pages/admin/Analytics'))

const S = (el: ReactNode) => <Suspense fallback={<div className="flex min-h-dvh items-center justify-center bg-night"><Spinner /></div>}>{el}</Suspense>

export const router = createBrowserRouter([
  {
    element: <App />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: S(<Home />) },
      { path: '/join', element: S(<Join />) },
      { path: '/privacy', element: S(<Privacy />) },
      { path: '/terms', element: S(<Privacy />) },
      { path: '/consent', element: S(<Privacy />) },
      { path: '/marketing-consent', element: S(<Privacy />) },
      { path: '/play', element: S(<Play />) },
      { path: '/g/:gameId', element: S(<PlayerGame />) },
      { path: '/host/:gameId', element: S(<HostGame />) },
      { path: '/admin/login', element: S(<Login />) },
      { path: '/start', element: S(<Start />) },
      { path: '/reset', element: S(<ResetPassword />) },
      { path: '/onboarding', element: S(<Onboarding />) },
      { path: '/learn', element: S(<Learn />) },
      { path: '/learn/:quizId', element: S(<Practice />) },
      { path: '/learn/:quizId/cards', element: S(<Flashcards />) },
      { path: '/learn/course/:courseId', element: S(<CoursePage />) },
      { path: '/pricing', element: S(<Pricing />) },
      { path: '/account', element: S(<Account />) },
      { path: '/avatar', element: S(<AvatarStudio />) },
      {
        path: '/admin',
        element: S(<AdminLayout />),
        children: [
          { index: true, element: S(<Dashboard />), errorElement: <RouteError /> },
          { path: 'quizzes', element: S(<QuizList />), errorElement: <RouteError /> },
          { path: 'quiz/:quizId', element: S(<QuizEditor />), errorElement: <RouteError /> },
          { path: 'games', element: S(<Games />), errorElement: <RouteError /> },
          { path: 'games/:gameId', element: S(<GameReport />), errorElement: <RouteError /> },
          { path: 'settings', element: S(<OwnerOnly><Settings /></OwnerOnly>), errorElement: <RouteError /> },
          { path: 'logs', element: S(<OwnerOnly perm="logs"><Logs /></OwnerOnly>), errorElement: <RouteError /> },
          { path: 'org', element: S(<OrgTeam />), errorElement: <RouteError /> },
          { path: 'console', element: S(<OwnerOnly perm="console"><Console /></OwnerOnly>), errorElement: <RouteError /> },
          { path: 'profile', element: S(<Profile />), errorElement: <RouteError /> },
          { path: 'sounds', element: S(<OwnerOnly><Sounds /></OwnerOnly>), errorElement: <RouteError /> },
          { path: 'team', element: S(<Team />), errorElement: <RouteError /> },
          { path: 'analytics', element: S(<Analytics />), errorElement: <RouteError /> },
          { path: 'classes', element: S(<Classes />), errorElement: <RouteError /> },
          { path: 'classes/:cid', element: S(<ClassDetail />), errorElement: <RouteError /> },
          { path: 'courses', element: S(<Courses />), errorElement: <RouteError /> },
        ],
      },
      { path: '*', element: S(<NotFound />) },
    ],
  },
])
