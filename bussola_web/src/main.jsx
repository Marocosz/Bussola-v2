import React from 'react'
import ReactDOM from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'; // [NOVO] Apenas este import
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

import './assets/styles/global.css' 
import 'weather-icons/css/weather-icons.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

// [NOVO] Pegamos o ID
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ErrorBoundary>
            <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                <App />
            </GoogleOAuthProvider>
        </ErrorBoundary>
    </React.StrictMode>,
)