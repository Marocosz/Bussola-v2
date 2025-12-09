import React, { useContext } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';

import { Navbar } from './components/Navbar'; 
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Financas } from './pages/Financas';
import { Panorama } from './pages/Panorama';
import { Registros } from './pages/Registros';
import { Cofre } from './pages/Cofre'; // <--- 1. IMPORTE O COFRE AQUI

const PrivateLayout = () => {
    const { authenticated, loading } = useContext(AuthContext);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#fff' }}>
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
            <div style={{ paddingTop: '80px', width: '100%' }}> 
                <Outlet />
            </div>
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
                <Route path="/registros" element={<Registros />} />
                
                {/* --- 2. ADICIONE ESTA LINHA --- */}
                <Route path="/cofre" element={<Cofre />} />
                
            </Route>

            <Route path="*" element={<Navigate to="/home" />} />
        </Routes>
    );
}