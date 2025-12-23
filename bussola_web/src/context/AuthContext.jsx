import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    // [NOVO] Estado para guardar os dados do usuário (Nome, Admin, etc)
    const [user, setUser] = useState(null);
    
    // Começa como null para sabermos que ainda não foi verificado
    const [authenticated, setAuthenticated] = useState(false);
    // Loading começa TRUE para segurar a renderização das rotas até verificarmos o storage
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Função que verifica se já existe um login salvo ao abrir o site
        const recoverUserCredentials = async () => {
            const storedToken = localStorage.getItem('@Bussola:token');

            if (storedToken) {
                try {
                    // Se tem token, injeta no axios
                    api.defaults.headers.Authorization = `Bearer ${storedToken}`;
                    
                    // [NOVO] Valida o token e busca os dados do usuário
                    const userResponse = await api.get('/users/me');
                    
                    setUser(userResponse.data); // Salva o usuário no estado
                    setAuthenticated(true);
                } catch (error) {
                    console.error("Token inválido ou expirado:", error);
                    // Se o token for inválido, limpa tudo
                    logout();
                }
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

            // [NOVO] Imediatamente após pegar o token, buscamos os dados do usuário
            const userResponse = await api.get('/users/me');
            setUser(userResponse.data);

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
        setUser(null); // [NOVO] Limpa o usuário ao sair
        setAuthenticated(false);
    };

    return (
        // [NOVO] Adicionamos 'user' no value para o Navbar poder ler
        <AuthContext.Provider value={{ authenticated, user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

// === ADIÇÃO NECESSÁRIA PARA O ROUTES.JSX FUNCIONAR ===
export function useAuth() {
    return useContext(AuthContext);
}