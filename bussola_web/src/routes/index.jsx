import { Routes, Route, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

import { Login } from '../pages/Login';
import { Home } from '../pages/Home';

const PrivateRoute = ({ children }) => {
    const { authenticated, loading } = useContext(AuthContext);

    // Enquanto verifica o localStorage, mostra carregando
    if (loading) {
        return <div className="loading-screen">Carregando...</div>;
    }

    // Se terminou de carregar e NÃO está autenticado -> Login
    if (!authenticated) {
        return <Navigate to="/login" />;
    }

    // Se está autenticado -> Mostra a página
    return children;
};

export const AppRoutes = () => {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/home" element={
                <PrivateRoute>
                    <Home />
                </PrivateRoute>
            } />
            
            {/* Qualquer rota desconhecida vai tentar ir para Home. 
                Se não estiver logado, o PrivateRoute da Home joga para Login. */}
            <Route path="*" element={<Navigate to="/home" />} />
        </Routes>
    );
};