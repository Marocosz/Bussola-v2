import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Estilos Globais
import './assets/styles/global.css' 

// Ícones de Clima (Home)
import 'weather-icons/css/weather-icons.css';

// --- ADICIONE ESTA LINHA (Ícones Gerais) ---
import '@fortawesome/fontawesome-free/css/all.min.css';
// -------------------------------------------

ReactDOM.createRoot(document.getElementById('root')).render(
    <App />
)