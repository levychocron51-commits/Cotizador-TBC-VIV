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
        <p style={{color: '#C8A46A', fontSize: 22, fontWeight: 700, marginBottom: 8}}>
          The Blind Concept
        </p>
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
            cursor: 'pointer'
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
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const check = setInterval(() => {
      if (window.netlifyIdentity) {
        clearInterval(check)

        window.netlifyIdentity.init({
          APIUrl: "https://guileless-sopapillas-2d1948.netlify.app/.netlify/identity"
        })

        const currentUser = window.netlifyIdentity.currentUser()
        if (currentUser) setUser(currentUser)
        setReady(true)

        // Detect invite_token or recovery_token in URL and open widget
        const hash = window.location.hash
        if (hash && (hash.includes('invite_token') || hash.includes('recovery_token') || hash.includes('confirmation_token'))) {
          setTimeout(() => {
            window.netlifyIdentity.open()
          }, 500)
        }

        window.netlifyIdentity.on('login', (u) => {
          setUser(u)
          window.netlifyIdentity.close()
          // Clean URL
          window.history.replaceState({}, document.title, '/')
        })

        window.netlifyIdentity.on('logout', () => {
          setUser(null)
        })
      }
    }, 100)

    return () => clearInterval(check)
  }, [])

  function handleLogin() {
    window.netlifyIdentity.open('login')
  }

  function handleLogout() {
    window.netlifyIdentity.logout()
  }

  if (!ready) {
    return (
      <div style={{minHeight:'100vh',background:'#0A0A0A',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{color:'#C8A46A',fontSize:14}}>Cargando...</div>
      </div>
    )
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />
  }

  const roles = getUserRoles()
  const hasTBC = roles.includes('tbc') || roles.includes('ambos')
  const hasVivendi = roles.includes('vivendi') || roles.includes('ambos')

  let defaultEmpresa = ''
  if (hasTBC && !hasVivendi) defaultEmpresa = 'TBC'
  if (hasVivendi && !hasTBC) defaultEmpresa = 'VIVENDI'

  return <App
    defaultEmpresa={defaultEmpresa}
    onlyEmpresa={hasTBC && !hasVivendi ? 'TBC' : hasVivendi && !hasTBC ? 'VIVENDI' : null}
    onLogout={handleLogout}
  />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
