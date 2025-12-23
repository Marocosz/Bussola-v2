import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; 

import { Navbar } from '../components/Navbar';
import { Login } from '../pages/Login';
import { Home } from '../pages/Home';
import { Financas } from '../pages/Financas';
import { Agenda } from '../pages/Agenda';
import { Registros } from '../pages/Registros';
import { Panorama } from '../pages/Panorama';
import { Cofre } from '../pages/Cofre';
import { Ritmo } from '../pages/Ritmo';
import { Register } from '../pages/Register';
import { ForgotPassword } from '../pages/Auth/ForgotPassword';
import { ResetPassword } from '../pages/Auth/ResetPassword';
import { VerifyEmail } from '../pages/Auth/VerifyEmail';
import { RegisterSuccess } from '../pages/Auth/RegisterSuccess';

function PrivateRoute({ children }) {
    const { authenticated, loading } = useAuth();

    if (loading) {
        return <div className="loading-screen">Carregando Usuário...</div>;
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

export function AppRoutes() {
    return (
        <Routes>
            {/* --- ROTAS PÚBLICAS --- */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/register-success" element={<RegisterSuccess />} />
            
            {/* --- ROTAS PRIVADAS --- */}
            <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
            <Route path="/home" element={<PrivateRoute><Home /></PrivateRoute>} />
            <Route path="/panorama" element={<PrivateRoute><Panorama /></PrivateRoute>} />
            <Route path="/financas" element={<PrivateRoute><Financas /></PrivateRoute>} />
            <Route path="/agenda" element={<PrivateRoute><Agenda /></PrivateRoute>} />
            <Route path="/registros" element={<PrivateRoute><Registros /></PrivateRoute>} />
            <Route path="/ritmo" element={<PrivateRoute><Ritmo /></PrivateRoute>} />
            <Route path="/cofre" element={<PrivateRoute><Cofre /></PrivateRoute>} />
        </Routes>
    );
}