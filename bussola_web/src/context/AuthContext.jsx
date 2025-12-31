import React, { createContext, useState, useEffect, useContext } from 'react';
import api, { updateUser, logoutSession } from '../services/api';

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
                    // Não chamamos logout() aqui para evitar loop com o interceptor
                    localStorage.removeItem('@Bussola:token');
                    localStorage.removeItem('@Bussola:refresh_token');
                    setAuthenticated(false);
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

            const response = await api.post('/auth/access-token', formData);
            const { access_token, refresh_token } = response.data;

            // Salva AMBOS os tokens
            localStorage.setItem('@Bussola:token', access_token);
            localStorage.setItem('@Bussola:refresh_token', refresh_token);
            
            api.defaults.headers.Authorization = `Bearer ${access_token}`;

            const userResponse = await api.get('/users/me');
            setUser(userResponse.data);

            setAuthenticated(true);
            return { success: true };
        } catch (error) {
            console.error("Erro no login:", error);
            // Verifica rate limit (429) ou erro de credencial
            if (error.response?.status === 429) {
                return { success: false, message: "Muitas tentativas. Tente novamente em alguns minutos." };
            }
            return { success: false, message: error.response?.data?.detail || "Email ou senha incorretos." };
        }
    };

    const loginGoogle = async (googleToken) => {
        try {
            const response = await api.post('/auth/google', { token: googleToken });
            const { access_token, refresh_token } = response.data;

            localStorage.setItem('@Bussola:token', access_token);
            localStorage.setItem('@Bussola:refresh_token', refresh_token);
            
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

    // Função para atualizar os dados do usuário no estado global
    const updateUserData = async (data) => {
        try {
            const updatedUser = await updateUser(data);
            setUser(updatedUser);
            return { success: true };
        } catch (error) {
            console.error("Erro ao atualizar usuário:", error);
            return { success: false, message: error.response?.data?.detail };
        }
    };

    const logout = async () => {
        // Tenta notificar o servidor para invalidar o refresh token (Blacklist)
        await logoutSession();

        localStorage.removeItem('@Bussola:token');
        localStorage.removeItem('@Bussola:refresh_token');
        api.defaults.headers.Authorization = undefined;
        setUser(null);
        setAuthenticated(false);
    };

    return (
        <AuthContext.Provider value={{ authenticated, user, login, loginGoogle, logout, updateUserData, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export function useAuth() {
    return useContext(AuthContext);
}