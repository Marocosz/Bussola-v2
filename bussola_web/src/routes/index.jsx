import React, { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import { Navbar } from '../components/Navbar';
import { MobileChromeProvider } from '../components/mobile/MobileChrome';
import { Login } from '../pages/Login';
import { Home } from '../pages/Home';
import { Financas } from '../pages/Financas';
// Metas é acessada por um modal dentro de Provisões (sem rota/navbar próprios).
import { Agenda } from '../pages/Agenda';
import { Registros } from '../pages/Registros';
import { Estudos } from '../pages/Estudos';
import { LeituraEstudo } from '../pages/Estudos/Leitura';
import { KitEstudos } from '../pages/Estudos/Kit';
import { Panorama } from '../pages/Panorama';
import { Cofre } from '../pages/Cofre';
import { Ritmo } from '../pages/Ritmo';
import { Register } from '../pages/Register';
import { ForgotPassword } from '../pages/Auth/ForgotPassword';
import { ResetPassword } from '../pages/Auth/ResetPassword';
import { VerifyEmail } from '../pages/Auth/VerifyEmail';
import { RegisterSuccess } from '../pages/Auth/RegisterSuccess';
import { DiscordLink } from '../pages/Auth/DiscordLink';
import { AutorizarConexao } from '../pages/Auth/AutorizarConexao';

// Bancada de componentes (somente em desenvolvimento; removida do build de produção).
const UiLab = import.meta.env.DEV ? lazy(() => import('../pages/UiLab').then((m) => ({ default: m.UiLab }))) : null;

function RequireAuth({ children }) {
    const { authenticated, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div className="loading-screen">Carregando Usuário...</div>;
    }

    if (!authenticated) {
        const next = encodeURIComponent(location.pathname + location.search);
        return <Navigate to={`/login?next=${next}`} replace />;
    }

    return children;
}

// Cada navegação começa no topo (a rolagem é da janela no mobile).
function ScrollToTop() {
    const { pathname } = useLocation();
    useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
    return null;
}

function PrivateRoute({ children }) {
    return (
        <RequireAuth>
            <ScrollToTop />
            <MobileChromeProvider>
                <div className="app-layout">
                    <Navbar />
                    <div className="app-content">
                        {children}
                    </div>
                </div>
            </MobileChromeProvider>
        </RequireAuth>
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
            <Route path="/discord/link" element={<PrivateRoute><DiscordLink /></PrivateRoute>} />
            <Route path="/conexoes/autorizar" element={<RequireAuth><AutorizarConexao /></RequireAuth>} />
            
            {/* --- ROTAS PRIVADAS --- */}
            <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
            <Route path="/home" element={<PrivateRoute><Home /></PrivateRoute>} />
            <Route path="/panorama" element={<PrivateRoute><Panorama /></PrivateRoute>} />
            <Route path="/financas" element={<PrivateRoute><Financas /></PrivateRoute>} />
            <Route path="/agenda" element={<PrivateRoute><Agenda /></PrivateRoute>} />
            <Route path="/registros" element={<PrivateRoute><Registros /></PrivateRoute>} />
            <Route path="/estudos" element={<PrivateRoute><Estudos /></PrivateRoute>} />
            <Route path="/estudos/kit" element={<PrivateRoute><KitEstudos /></PrivateRoute>} />
            <Route path="/estudos/:id" element={<PrivateRoute><LeituraEstudo /></PrivateRoute>} />
            <Route path="/ritmo" element={<PrivateRoute><Ritmo /></PrivateRoute>} />
            <Route path="/cofre" element={<PrivateRoute><Cofre /></PrivateRoute>} />
            {UiLab && (
                <Route path="/__ui" element={<PrivateRoute><Suspense fallback={null}><UiLab /></Suspense></PrivateRoute>} />
            )}
        </Routes>
    );
}