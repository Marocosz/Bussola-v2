import axios from 'axios';

// Cria uma instância do Axios com a URL base do seu backend FastAPI
const api = axios.create({
    baseURL: 'http://127.0.0.1:8000/api/v1',
});

// --- INTERCEPTOR (O porteiro das requisições) ---
// Antes de cada requisição sair do React, verificamos se temos um token salvo.
// Se tiver, injetamos automaticamente no cabeçalho "Authorization".
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('@Bussola:token');
    
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
});

export default api;