import { useEffect } from 'react'
import { useLocation, useNavigate, type Location, type NavigateFunction } from 'react-router-dom'

/** Tells a test where the router is and hands it navigate(). */
export default function RouterProbe({ onRouter }: { onRouter: (l: Location, n: NavigateFunction) => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    onRouter(location, navigate)
  })
  return null
}
