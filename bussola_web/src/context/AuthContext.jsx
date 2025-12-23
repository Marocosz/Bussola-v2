import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [authenticated, setAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const recoverUserCredentials = async () => {
            const storedToken = localStorage.getItem('@Bussola:token');

            if (storedToken) {
                try {
                    api.defaults.headers.Authorization = `Bearer ${storedToken}`;
                    const userResponse = await api.get('/users/me');
                    
                    setUser(userResponse.data);
                    setAuthenticated(true);
                } catch (error) {
                    console.error("Token inválido ou expirado:", error);
                    logout();
                }
            }
            setLoading(false);
        };

        recoverUserCredentials();
    }, []);

    const login = async (email, password) => {
        try {
            const formData = new URLSearchParams();
            formData.append('username', email);
            formData.append('password', password);

            const response = await api.post('/login/access-token', formData);
            const { access_token } = response.data;

            localStorage.setItem('@Bussola:token', access_token);
            api.defaults.headers.Authorization = `Bearer ${access_token}`;

            const userResponse = await api.get('/users/me');
            setUser(userResponse.data);

            setAuthenticated(true);
            return { success: true };
        } catch (error) {
            console.error("Erro no login:", error);
            return { success: false, message: "Email ou senha incorretos." };
        }
    };

    // [NOVO] Função para Login com Google
    const loginGoogle = async (googleToken) => {
        try {
            // Envia o token para o backend
            const response = await api.post('/login/google', { token: googleToken });
            const { access_token } = response.data;

            localStorage.setItem('@Bussola:token', access_token);
            api.defaults.headers.Authorization = `Bearer ${access_token}`;

            const userResponse = await api.get('/users/me');
            setUser(userResponse.data);

            setAuthenticated(true);
            return { success: true };
        } catch (error) {
            console.error("Erro no login Google:", error);
            return { success: false, message: "Falha ao autenticar com Google." };
        }
    };

    const logout = () => {
        localStorage.removeItem('@Bussola:token');
        api.defaults.headers.Authorization = undefined;
        setUser(null);
        setAuthenticated(false);
    };

    return (
        // [NOVO] Adicionado loginGoogle ao value
        <AuthContext.Provider value={{ authenticated, user, login, loginGoogle, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export function useAuth() {
    return useContext(AuthContext);
}