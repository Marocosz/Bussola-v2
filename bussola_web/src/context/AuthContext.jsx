import { createContext, useState, useEffect } from 'react';
import api from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true); // Para não mostrar a tela antes de verificar o token

    useEffect(() => {
        // Ao recarregar a página, verifica se já tem token salvo
        const recoverUser = async () => {
            const storedToken = localStorage.getItem('@Bussola:token');

            if (storedToken) {
                try {
                    // Opcional: Aqui você poderia bater numa rota /me para pegar dados atualizados do user
                    // Por enquanto, assumimos que se tem token, está logado.
                    setUser({ token: storedToken }); 
                    api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
                } catch (error) {
                    logout();
                }
            }
            setLoading(false);
        };

        recoverUser();
    }, []);

    const login = async (email, password) => {
        try {
            // O FastAPI espera dados de formulário (x-www-form-urlencoded) no endpoint /login/access-token
            const formData = new URLSearchParams();
            formData.append('username', email); // FastAPI OAuth2 usa 'username' mesmo sendo email
            formData.append('password', password);

            const response = await api.post('/login/access-token', formData);

            const { access_token } = response.data;

            // Salva no navegador e no estado
            localStorage.setItem('@Bussola:token', access_token);
            api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
            
            setUser({ email, token: access_token });
            return { success: true };

        } catch (error) {
            console.error("Erro no login:", error);
            return { success: false, message: "Email ou senha incorretos." };
        }
    };

    const logout = () => {
        localStorage.removeItem('@Bussola:token');
        api.defaults.headers.common['Authorization'] = null;
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ authenticated: !!user, user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};