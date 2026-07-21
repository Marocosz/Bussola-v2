import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './routes'; 
import './assets/styles/global.css'; 

import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmDialogProvider } from './context/ConfirmDialogContext';
import { SystemProvider } from './context/SystemContext';
import { TooltipHost } from './components/Tooltip';

function App() {
    return (
        <BrowserRouter>
            <ToastProvider>
                <SystemProvider>
                    <AuthProvider>
                        <ConfirmDialogProvider>
                            <AppRoutes />
                            <TooltipHost />
                        </ConfirmDialogProvider>
                    </AuthProvider>
                </SystemProvider>
            </ToastProvider>
        </BrowserRouter>
    );
}

export default App;