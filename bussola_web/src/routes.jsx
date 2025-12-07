import React, { useContext } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import { Panorama } from './pages/Panorama';
import { Navbar } from './components/Navbar'; 
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Financas } from './pages/Financas';

const PrivateLayout = () => {
    const { authenticated, loading } = useContext(AuthContext);

    // 1. Estilizando o loading para garantir que seja visível
    if (loading) {
        return (
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh', 
                color: '#fff' 
            }}>
                Carregando sistema...
            </div>
        );
    }

    if (!authenticated) {
        return <Navigate to="/login" />;
    }

    return (
        <>
            <Navbar />
            {/* 2. REMOVIDA a tag <main> que envolvia o Outlet. 
                A Home já tem seu próprio container, isso evita conflito de CSS. */}
            <Outlet />
        </>
    );
};

export function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />

            <Route element={<PrivateLayout />}>
                <Route path="/home" element={<Home />} />
                <Route path="/financas" element={<Financas />} />
                <Route path="/panorama" element={<Panorama />} />
            </Route>

            <Route path="*" element={<Navigate to="/home" />} />
        </Routes>
    );
}