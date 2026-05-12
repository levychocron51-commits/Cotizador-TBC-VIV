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

function hasIdentityToken() {
  const hash = window.location.hash
  return hash && (
    hash.includes('invite_token') ||
    hash.includes('recovery_token') ||
    hash.includes('confirmation_token')
  )
}

// Registrar los listeners ANTES de que React monte cualquier cosa
// El script de netlify-identity-widget ya cargo en index.html
// asi que window.netlifyIdentity ya existe aqui
const ni = window.netlifyIdentity
ni.on('init', () => {})
ni.on('login', () => {})
ni.on('logout', () => {})
ni.init({
  APIUrl: "https://guileless-sopapillas-2d1948.netlify.app/.netlify/identity"
})

function Root() {
  const [user, setUser] = useState(() => {
    try { return window.netlifyIdentity.currentUser() || null }
    catch(e) { return null }
  })
  const [ready, setReady] = useState(false)
  const [tokenMode] = useState(hasIdentityToken())

  useEffect(() => {
    const ni = window.netlifyIdentity

    ni.on('init', (u) => {
      if (u) setUser(u)
      setReady(true)
    })

    ni.on('login', (u) => {
      setUser(u)
      ni.close()
      window.history.replaceState({}, document.title, '/')
    })

    ni.on('logout', () => {
      setUser(null)
    })

    // Fallback por si el evento init ya disparo antes del useEffect
    setReady(true)
  }, [])

  function handleLogin() { window.netlifyIdentity.open('login') }
  function handleLogout() { window.netlifyIdentity.logout() }

  if (!ready) return (
    <div style={{minHeight:'100vh',background:'#0A0A0A',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{color:'#C8A46A',fontSize:14}}>Cargando...</div>
    </div>
  )

  if (user) {
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

  // Con token: pantalla de espera, el widget abre su modal solo
  if (tokenMode) return (
    <div style={{minHeight:'100vh',background:'#0A0A0A',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"-apple-system,sans-serif"}}>
      <div style={{background:'#111',border:'1px solid #222',borderRadius:16,padding:'48px 40px',maxWidth:400,width:'100%',textAlign:'center'}}>
        <p style={{color:'#C8A46A',fontSize:22,fontWeight:700,marginBottom:8}}>The Blind Concept</p>
        <p style={{color:'#666',fontSize:13,marginBottom:24}}>Abriendo formulario de acceso...</p>
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:24}}>
          <div style={{width:8,height:8,borderRadius:'50%',background:'#B8965A',animation:'pulse 1.2s ease-in-out infinite'}}></div>
          <div style={{width:8,height:8,borderRadius:'50%',background:'#B8965A',animation:'pulse 1.2s ease-in-out 0.4s infinite'}}></div>
          <div style={{width:8,height:8,borderRadius:'50%',background:'#B8965A',animation:'pulse 1.2s ease-in-out 0.8s infinite'}}></div>
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:0.2}50%{opacity:1}}`}</style>
        <p style={{color:'#555',fontSize:11,cursor:'pointer'}}
           onClick={() => window.history.replaceState({}, document.title, window.location.pathname + window.location.search) || window.location.reload()}>
          Si no se abre nada, haz clic aqui para recargar
        </p>
      </div>
    </div>
  )

  // Sin token: pantalla normal de login
  return (
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
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><Root /></React.StrictMode>
)
