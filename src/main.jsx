import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

function getUserRoles() {
  try {
    const user = window.netlifyIdentity && window.netlifyIdentity.currentUser()
    if (!user) return []
    const roles = user.app_metadata && user.app_metadata.roles
    return Array.isArray(roles) ? roles : []
  } catch (e) {
    return []
  }
}

function LoginScreen({ onLogin }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0A0A0A',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "-apple-system, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif"
    }}>
      <div style={{
        background: '#111',
        border: '1px solid #222',
        borderRadius: 16,
        padding: '48px 40px',
        maxWidth: 400,
        width: '100%',
        textAlign: 'center'
      }}>
        <svg width="160" height="60" viewBox="0 0 440 158" fill="none" xmlns="http://www.w3.org/2000/svg" style={{marginBottom: 24}}>
          <rect x="2" y="2" width="116" height="154" rx="1.5" stroke="#C8A46A" strokeWidth="3.5" fill="none"/>
          <line x1="30" y1="2" x2="30" y2="156" stroke="#C8A46A" strokeWidth="3"/>
          <line x1="52" y1="2" x2="52" y2="156" stroke="#C8A46A" strokeWidth="3"/>
          <line x1="74" y1="2" x2="74" y2="156" stroke="#C8A46A" strokeWidth="3"/>
          <line x1="74" y1="28" x2="118" y2="28" stroke="#C8A46A" strokeWidth="2.5"/>
          <line x1="74" y1="48" x2="118" y2="48" stroke="#C8A46A" strokeWidth="2.5"/>
          <line x1="74" y1="68" x2="118" y2="68" stroke="#C8A46A" strokeWidth="2.5"/>
          <line x1="74" y1="88" x2="118" y2="88" stroke="#C8A46A" strokeWidth="2.5"/>
          <line x1="74" y1="108" x2="118" y2="108" stroke="#C8A46A" strokeWidth="2.5"/>
          <line x1="74" y1="128" x2="118" y2="128" stroke="#C8A46A" strokeWidth="2.5"/>
          <text x="138" y="52" fontFamily="Georgia, serif" fontSize="48" fontWeight="400" fill="#C8A46A">The</text>
          <text x="138" y="106" fontFamily="Georgia, serif" fontSize="48" fontWeight="400" fill="#C8A46A">Blind</text>
          <text x="138" y="154" fontFamily="Georgia, serif" fontSize="48" fontWeight="400" fill="#C8A46A">Concept</text>
        </svg>
        <p style={{color: '#666', fontSize: 13, marginBottom: 32}}>
          Acceso exclusivo para colaboradores
        </p>
        <button
          onClick={onLogin}
          style={{
            width: '100%',
            padding: '14px 24px',
            background: '#B8965A',
            border: 'none',
            borderRadius: 12,
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: 0.5
          }}
        >
          Iniciar Sesión
        </button>
      </div>
    </div>
  )
}

function Root() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const identity = window.netlifyIdentity

    // Check if already logged in
    const currentUser = identity.currentUser()
    if (currentUser) {
      setUser(currentUser)
    }
    setLoading(false)

    // Listen for login
    identity.on('login', (u) => {
      setUser(u)
      identity.close()
    })

    // Listen for logout
    identity.on('logout', () => {
      setUser(null)
    })

    // Auto-open if coming from invite link
    identity.on('init', (u) => {
      if (!u) setLoading(false)
    })
  }, [])

  function handleLogin() {
    window.netlifyIdentity.open('login')
  }

  function handleLogout() {
    window.netlifyIdentity.logout()
  }

  if (loading) {
    return (
      <div style={{minHeight:'100vh',background:'#0A0A0A',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{color:'#C8A46A',fontSize:14}}>Cargando...</div>
      </div>
    )
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />
  }

  // Get roles and determine empresa
  const roles = getUserRoles()
  const hasTBC = roles.includes('tbc') || roles.includes('ambos')
  const hasVivendi = roles.includes('vivendi') || roles.includes('ambos')
  
  // Auto-assign empresa if only one role
  let defaultEmpresa = ''
  if (hasTBC && !hasVivendi) defaultEmpresa = 'TBC'
  if (hasVivendi && !hasTBC) defaultEmpresa = 'VIVENDI'

  return <App defaultEmpresa={defaultEmpresa} onlyEmpresa={hasTBC && !hasVivendi ? 'TBC' : hasVivendi && !hasTBC ? 'VIVENDI' : null} onLogout={handleLogout} />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
