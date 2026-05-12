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

function Root() {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [debugInfo, setDebugInfo] = useState(null)
  const [showDebug, setShowDebug] = useState(false)

  function collectDebug() {
    const ni = window.netlifyIdentity
    const info = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      hash: window.location.hash || '(vacio)',
      widgetLoaded: !!ni,
      currentUser: null,
      localStorageKeys: [],
      localStorageData: {}
    }
    try {
      if (ni) {
        const cu = ni.currentUser()
        if (cu) {
          info.currentUser = {
            id: cu.id,
            email: cu.email,
            app_metadata: cu.app_metadata,
            user_metadata: cu.user_metadata,
            confirmed_at: cu.confirmed_at,
            created_at: cu.created_at,
            token: cu.token ? '(presente)' : '(ausente)'
          }
        }
      }
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && (k.includes('gotrue') || k.includes('netlify') || k.includes('identity'))) {
          info.localStorageKeys.push(k)
          info.localStorageData[k] = localStorage.getItem(k)
        }
      }
    } catch(e) {
      info.error = e.message
    }
    return info
  }

  useEffect(() => {
    const ni = window.netlifyIdentity
    if (!ni) {
      setReady(true)
      return
    }

    const existingUser = ni.currentUser()
    if (existingUser) {
      setUser(existingUser)
    }

    const handleInit = (u) => {
      if (u) setUser(u)
      setReady(true)
    }
    const handleLogin = (u) => {
      setUser(u)
      ni.close()
      window.history.replaceState({}, document.title, '/')
    }
    const handleLogout = () => {
      setUser(null)
    }
    const handleError = (err) => {
      console.error('Netlify Identity error:', err)
    }

    ni.on('init', handleInit)
    ni.on('login', handleLogin)
    ni.on('logout', handleLogout)
    ni.on('error', handleError)

    ni.init({
      APIUrl: "https://guileless-sopapillas-2d1948.netlify.app/.netlify/identity"
    })

    const fallback = setTimeout(() => {
      const u = ni.currentUser()
      if (u) setUser(u)
      setReady(true)
    }, 2000)

    return () => {
      clearTimeout(fallback)
      try {
        ni.off('init', handleInit)
        ni.off('login', handleLogin)
        ni.off('logout', handleLogout)
        ni.off('error', handleError)
      } catch(e) {}
    }
  }, [])

  function handleLoginClick() { window.netlifyIdentity.open('login') }
  function handleLogoutClick() { window.netlifyIdentity.logout() }
  function handleDebugClick() {
    const info = collectDebug()
    setDebugInfo(info)
    setShowDebug(true)
  }
  function copyDebug() {
    if (!debugInfo) return
    const text = JSON.stringify(debugInfo, null, 2)
    navigator.clipboard.writeText(text).then(() => {
      alert('Reporte copiado al portapapeles. Pegalo en el chat.')
    }).catch(() => {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      alert('Reporte copiado. Pegalo en el chat.')
    })
  }

  if (showDebug && debugInfo) {
    return (
      <div style={{minHeight:'100vh',background:'#0A0A0A',padding:'30px 20px',fontFamily:"-apple-system,sans-serif",color:'#e8e8e8'}}>
        <div style={{maxWidth:720,margin:'0 auto'}}>
          <h2 style={{color:'#C8A46A',marginBottom:8}}>Diagnostico de sesion</h2>
          <p style={{color:'#888',fontSize:13,marginBottom:20}}>Copia este reporte y mandamelo en el chat</p>
          <pre style={{background:'#141414',border:'1px solid #222',borderRadius:10,padding:16,fontSize:11,color:'#9ad',overflowX:'auto',whiteSpace:'pre-wrap',wordBreak:'break-all',maxHeight:'60vh',overflowY:'auto'}}>{JSON.stringify(debugInfo,null,2)}</pre>
          <button onClick={copyDebug} style={{width:'100%',padding:14,background:'#B8965A',border:'none',borderRadius:10,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',marginTop:16}}>Copiar reporte</button>
          <button onClick={() => setShowDebug(false)} style={{width:'100%',padding:12,background:'transparent',border:'1px solid #333',borderRadius:10,color:'#aaa',fontSize:13,cursor:'pointer',marginTop:8}}>Volver</button>
        </div>
      </div>
    )
  }

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
      onLogout={handleLogoutClick}
    />
  }

  return (
    <div style={{minHeight:'100vh',background:'#0A0A0A',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"-apple-system,sans-serif"}}>
      <div style={{background:'#111',border:'1px solid #222',borderRadius:16,padding:'48px 40px',maxWidth:400,width:'100%',textAlign:'center'}}>
        <p style={{color:'#C8A46A',fontSize:22,fontWeight:700,marginBottom:8}}>The Blind Concept</p>
        <p style={{color:'#666',fontSize:13,marginBottom:32}}>Acceso exclusivo para colaboradores</p>
        <button onClick={handleLoginClick} style={{width:'100%',padding:'14px 24px',background:'#B8965A',border:'none',borderRadius:12,color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer'}}>
          Iniciar Sesion
        </button>
        <button onClick={handleDebugClick} style={{width:'100%',padding:'10px 24px',background:'transparent',border:'1px solid #333',borderRadius:10,color:'#666',fontSize:11,cursor:'pointer',marginTop:12}}>
          Ver diagnostico
        </button>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><Root /></React.StrictMode>
)
