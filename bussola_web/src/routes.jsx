import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmDialogProvider } from './context/ConfirmDialogContext';

import { Navbar } from './components/Navbar';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Financas } from './pages/Financas';
import { Agenda } from './pages/Agenda';
import { Registros } from './pages/Registros';
import { Panorama } from './pages/Panorama';
import { Cofre } from './pages/Cofre';
import { Ritmo } from './pages/Ritmo'; // <--- Importação da nova página

// --- DEFINIÇÃO DO COMPONENTE DE ROTA PRIVADA ---
function PrivateRoute({ children }) {
    const { authenticated, loading } = useAuth();

    if (loading) {
        return <div className="loading-screen">Carregando...</div>;
    }

    if (!authenticated) {
        return <Navigate to="/login" />;
    }

    return (
        <div className="app-layout">
            <Navbar />
            <div className="app-content">
                {children}
            </div>
        </div>
    );
}
// -----------------------------------------------

export function AppRoutes() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <ToastProvider>
                    <ConfirmDialogProvider>
                        <Routes>
                            <Route path="/login" element={<Login />} />
                            
                            <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
                            <Route path="/home" element={<PrivateRoute><Home /></PrivateRoute>} />
                            <Route path="/panorama" element={<PrivateRoute><Panorama /></PrivateRoute>} />
                            <Route path="/financas" element={<PrivateRoute><Financas /></PrivateRoute>} />
                            <Route path="/agenda" element={<PrivateRoute><Agenda /></PrivateRoute>} />
                            <Route path="/registros" element={<PrivateRoute><Registros /></PrivateRoute>} />
                            
                            {/* Rota do Ritmo */}
                            <Route path="/ritmo" element={<PrivateRoute><Ritmo /></PrivateRoute>} />
                            
                            <Route path="/cofre" element={<PrivateRoute><Cofre /></PrivateRoute>} />
                        </Routes>
                    </ConfirmDialogProvider>
                </ToastProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}