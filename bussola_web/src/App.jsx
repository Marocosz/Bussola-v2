import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmDialogProvider } from './context/ConfirmDialogContext'; // <--- Importação Nova
import { AppRoutes } from './routes'; 
import './assets/styles/global.css'; 

function App() {
    return (
        <BrowserRouter>
            <ToastProvider>
                <AuthProvider>
                    {/* O Provider deve envolver as rotas para que as páginas tenham acesso ao hook */}
                    <ConfirmDialogProvider>
                        <AppRoutes />
                    </ConfirmDialogProvider>
                </AuthProvider>
            </ToastProvider>
        </BrowserRouter>
    );
}

export default App;