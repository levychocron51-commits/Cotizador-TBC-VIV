import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// El acceso al sitio lo controla Netlify directamente (password protection o identity-based access)
// El cotizador se abre directo sin ningun login propio

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App defaultEmpresa="" onlyEmpresa={null} onLogout={null} />
  </React.StrictMode>
)
