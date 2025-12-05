import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { useContext } from 'react';
import { Login } from './pages/Login';

// Componente para proteger rotas privadas
const PrivateRoute = ({ children }) => {
    const { authenticated, loading } = useContext(AuthContext);

    if (loading) {
        return <div>Carregando...</div>;
    }

    if (!authenticated) {
        return <Navigate to="/login" />;
    }

    return children;
};

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    
                    {/* Rota Protegida de Teste */}
                    <Route path="/dashboard" element={
                        <PrivateRoute>
                            <h1>Bem-vindo ao Dashboard do Bússola! 🧭</h1>
                        </PrivateRoute>
                    } />
                    
                    {/* Redireciona raiz para dashboard */}
                    <Route path="/" element={<Navigate to="/dashboard" />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;