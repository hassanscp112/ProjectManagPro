import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/ibm-plex-sans-arabic/400.css'
import '@fontsource/ibm-plex-sans-arabic/500.css'
import '@fontsource/ibm-plex-sans-arabic/600.css'
import '@fontsource/ibm-plex-sans-arabic/700.css'
import './ui/tokens.css'
import './ui/base.css'
import './index.css'
import App from './App.jsx'
import { I18nProvider } from './i18n/I18nContext.jsx'
import { UiProvider } from './ui/UiProvider.jsx'

// Dev-only component review page: http://localhost:5173/#/dev/ui
// (stripped from production builds; the router takes this over in Phase 1).
const isUiReview = import.meta.env.DEV && window.location.hash.startsWith('#/dev/ui')
const UiReview = isUiReview ? lazy(() => import('./dev/UiReview.jsx')) : null

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <UiProvider>
        {UiReview ? (
          <Suspense fallback={null}>
            <UiReview />
          </Suspense>
        ) : (
          <App />
        )}
      </UiProvider>
    </I18nProvider>
  </StrictMode>,
)
