import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Chat from './pages/Chat'
import Radar from './pages/Radar'
import Pipeline from './pages/Pipeline'
import Conhecimento from './pages/Conhecimento'
import Contatos from './pages/Contatos'
import Configuracoes from './pages/Configuracoes'
import CS from './pages/CS'
import CSCliente from './pages/CSCliente'
import ReportPublic from './pages/ReportPublic'

function ProtectedRoute({ children, adminOnly = false }) {
  const raw  = localStorage.getItem('iara_user')
  const user = raw ? JSON.parse(raw) : null
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && !user.admin) return <Navigate to="/pipeline" replace />
  return children
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rotas públicas — sem login */}
        <Route path="/report/:token"  element={<ReportPublic />} />

        {/* Autenticação */}
        <Route path="/login"          element={<Login />} />

        {/* Rotas protegidas */}
        <Route path="/pipeline"       element={<ProtectedRoute><Pipeline /></ProtectedRoute>} />
        <Route path="/chat"           element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        <Route path="/contatos"       element={<ProtectedRoute><Contatos /></ProtectedRoute>} />
        <Route path="/cs"             element={<ProtectedRoute><CS /></ProtectedRoute>} />
        <Route path="/cs/:conta"      element={<ProtectedRoute><CSCliente /></ProtectedRoute>} />
        <Route path="/radar"          element={<ProtectedRoute><Radar /></ProtectedRoute>} />
        <Route path="/conhecimento"   element={<ProtectedRoute><Conhecimento /></ProtectedRoute>} />
        <Route path="/configuracoes"  element={<ProtectedRoute adminOnly><Configuracoes /></ProtectedRoute>} />

        {/* Fallbacks */}
        <Route path="/"               element={<Navigate to="/pipeline" replace />} />
        <Route path="*"               element={<Navigate to="/pipeline" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
