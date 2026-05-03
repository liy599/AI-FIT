import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

import './styles/legacy-vendor.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/app.css'
import './styles/tokens.css'
import './styles/ui-components.css'
import './styles/generated/utilities-compat.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
