import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

// Import global styles (order matters: base 鈫?layout 鈫?components 鈫?utilities)
import './styles/legacy-vendor.css'        // Third-party / legacy styles
import './styles/base.css'                 // Reset & base styles (html, body, typography)
import './styles/layout.css'               // Layout system (grid, containers, spacing)
import './styles/app.css'                  // App-specific styles
import './styles/tokens.css'               // Design tokens (colors, spacing, variables)
import './styles/ui-components.css'        // Reusable UI components styles
import './styles/generated/utilities-compat.css' // Utility classes (auto-generated)

// Create React root and mount the app into the DOM element with id="root"
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Enables React development checks and warnings */}

    <BrowserRouter>
      {/* Provides routing (URL-based navigation) for the entire app */}

      <App />
      {/* Root component of your application */}

    </BrowserRouter>
  </React.StrictMode>
)
