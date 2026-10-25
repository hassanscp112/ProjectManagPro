import { StrictMode } from 'react'
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

// Legacy screens are light-only, so the app stays light until the theme
// setting arrives (Phase 6). Set before the first paint: no dark flash.
// The dev review page (/#/dev/ui) still switches themes itself.
document.documentElement.setAttribute('data-theme', 'light')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <UiProvider>
        <App />
      </UiProvider>
    </I18nProvider>
  </StrictMode>,
)
