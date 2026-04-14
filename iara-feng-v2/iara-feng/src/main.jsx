import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Chat from './pages/Chat'
import Radar from './pages/Radar'
import Pipeline from './pages/Pipeline'
import Conhecimento from './pages/Conhecimento'
import Contatos from './pages/Contatos'

function ProtectedRoute({ children }) {
  const user = localStorage.getItem('iara_user')
  return user ? children : <Navigate to="/login" />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        <Route path="/radar" element={<ProtectedRoute><Radar /></ProtectedRoute>} />
        <Route path="/pipeline" element={<ProtectedRoute><Pipeline /></ProtectedRoute>} />
        <Route path="/conhecimento" element={<ProtectedRoute><Conhecimento /></ProtectedRoute>} />
        <Route path="/contatos" element={<ProtectedRoute><Contatos /></ProtectedRoute>} />
        <Route path="/" element={<Navigate to="/pipeline" replace />} />
        <Route path="*" element={<Navigate to="/pipeline" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
