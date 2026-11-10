import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import Compare from './pages/Compare'
import ListingDetail from './pages/ListingDetail'
import NotFound from './pages/NotFound'
import Results from './pages/Results'
import Saved from './pages/Saved'
import Welcome from './pages/Welcome'
import { AppStateProvider, useAppState } from './state/AppState'

function Home() {
  const { budget } = useAppState()
  return budget === null ? <Welcome /> : <Navigate to="/results" replace />
}

function Layout() {
  return (
    <div className="min-h-full pb-24">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[2000] focus:bg-card focus:p-2"
      >
        Skip to content
      </a>
      <main id="main">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route element={<Layout />}>
        <Route path="/results" element={<Results />} />
        <Route path="/listing/:id" element={<ListingDetail />} />
        <Route path="/saved" element={<Saved />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AppStateProvider>
        <AppRoutes />
      </AppStateProvider>
    </BrowserRouter>
  )
}
