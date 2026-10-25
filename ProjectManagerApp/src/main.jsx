import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/ibm-plex-sans-arabic/400.css'
import '@fontsource/ibm-plex-sans-arabic/500.css'
import '@fontsource/ibm-plex-sans-arabic/600.css'
import '@fontsource/ibm-plex-sans-arabic/700.css'
import './ui/tokens.css'
import './ui/base.css'
import App from './App.jsx'
import { I18nProvider } from './i18n/I18nContext.jsx'
import { UiProvider } from './ui/UiProvider.jsx'
import { applyTheme, loadTheme } from './utils/Theme.js'
import { ensureProjects } from './utils/Projects.js'
import { requestPersistentStorage } from './utils/StoragePersistence.js'

// The saved theme (Settings → Appearance), applied before the first paint
// so there is no flash. The dev review page (/#/dev/ui) switches it itself.
applyTheme(loadTheme())

// Data saved before multi-project support becomes the first project.
ensureProjects()

// Ask the browser not to evict our data under disk pressure (Settings →
// Backup shows the result).
requestPersistentStorage()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <UiProvider>
        <App />
      </UiProvider>
    </I18nProvider>
  </StrictMode>,
)
