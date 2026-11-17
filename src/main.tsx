import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { isDemo } from './lib/backend'

// Demo mode starts over on every refresh, so forget anything an earlier visit kept in this browser.
if (isDemo) {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('shp.')) localStorage.removeItem(k)
  } catch {
    // Storage may be blocked; the demo works without it.
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
