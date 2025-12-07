import React, { createContext, useState, useEffect } from 'react';
import api from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    // Começa como null para sabermos que ainda não foi verificado
    const [authenticated, setAuthenticated] = useState(false);
    // Loading começa TRUE para segurar a renderização das rotas até verificarmos o storage
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Função que verifica se já existe um login salvo ao abrir o site
        const recoverUserCredentials = async () => {
            const storedToken = localStorage.getItem('@Bussola:token');

            if (storedToken) {
                // Se tem token, injeta no axios e marca como autenticado
                api.defaults.headers.Authorization = `Bearer ${storedToken}`;
                setAuthenticated(true);
            }

            // Só depois de verificar o storage nós paramos o loading
            setLoading(false);
        };

        recoverUserCredentials();
    }, []);

    const login = async (email, password) => {
        try {
            // Chama o backend (formato x-www-form-urlencoded exigido pelo OAuth2 do FastAPI)
            const formData = new URLSearchParams();
            formData.append('username', email); // FastAPI espera 'username', mesmo sendo email
            formData.append('password', password);

            const response = await api.post('/login/access-token', formData);

            const { access_token } = response.data;

            // Salva no LocalStorage e na API
            localStorage.setItem('@Bussola:token', access_token);
            api.defaults.headers.Authorization = `Bearer ${access_token}`;

            setAuthenticated(true);
            
            return { success: true };
        } catch (error) {
            console.error("Erro no login:", error);
            return { 
                success: false, 
                message: "Email ou senha incorretos." 
            };
        }
    };

    const logout = () => {
        localStorage.removeItem('@Bussola:token');
        api.defaults.headers.Authorization = undefined;
        setAuthenticated(false);
    };

    return (
        <AuthContext.Provider value={{ authenticated, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};