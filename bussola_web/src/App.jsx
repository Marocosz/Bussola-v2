import React from 'react';
import { AppRoutes } from './routes'; 
import './assets/styles/global.css'; 

function App() {
    // Apenas renderiza as rotas. 
    // Toda a configuração (Router, AuthProvider, Toast) agora está dentro de AppRoutes.
    return (
        <AppRoutes />
    );
}

export default App;