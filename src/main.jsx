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

// Detecta si la URL tiene un token de Netlify Identity
function hasIdentityToken() {
  return window.location.hash &&
    (window.location.hash.includes('invite_token') ||
     window.location.hash.includes('recovery_token') ||
     window.location.hash.includes('confirmation_token'))
}

function Root() {
  const [user, setUser] = useState(null)
  // Si hay token en la URL arrancamos en ready=true directamente
  // para que el widget pueda montar el modal sin esperar
  const [ready, setReady] = useState(hasIdentityToken())

  useEffect(() => {
    const check = setInterval(() => {
      if (!window.netlifyIdentity) return
      clearInterval(check)
      const ni = window.netlifyIdentity

      ni.on('init', (u) => {
        if (u) setUser(u)
        setReady(true)
        // Si hay token, abrir el widget inmediatamente
        if (hasIdentityToken()) {
          ni.open()
        }
      })

      ni.on('login', (u) => {
        setUser(u)
        ni.close()
        window.history.replaceState({}, document.title, '/')
      })

      ni.on('logout', () => {
        setUser(null)
      })

      ni.init({
        APIUrl: "https://guileless-sopapillas-2d1948.netlify.app/.netlify/identity"
      })

      setTimeout(() => setReady(true), 5000)
    }, 50)

    return () => clearInterval(check)
  }, [])

  function handleLogin() { window.netlifyIdentity.open('login') }
  function handleLogout() { window.netlifyIdentity.logout() }

  if (!ready) return (
    <div style={{minHeight:'100vh',background:'#0A0A0A',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{color:'#C8A46A',fontSize:14}}>Cargando...</div>
    </div>
  )

  if (!user) return (
    <div style={{minHeight:'100vh',background:'#0A0A0A',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"-apple-system,sans-serif"}}>
      <div style={{background:'#111',border:'1px solid #222',borderRadius:16,padding:'48px 40px',maxWidth:400,width:'100%',textAlign:'center'}}>
        <p style={{color:'#C8A46A',fontSize:22,fontWeight:700,marginBottom:8}}>The Blind Concept</p>
        <p style={{color:'#666',fontSize:13,marginBottom:32}}>Acceso exclusivo para colaboradores</p>
        <button onClick={handleLogin} style={{width:'100%',padding:'14px 24px',background:'#B8965A',border:'none',borderRadius:12,color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer'}}>
          Iniciar Sesion
        </button>
      </div>
    </div>
  )

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
  <React.StrictMode><Root /></React.StrictMode>
)
