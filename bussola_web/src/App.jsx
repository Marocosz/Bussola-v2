import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AppRoutes } from './routes'; 
import './assets/styles/global.css'; 

function App() {
    return (
        <BrowserRouter>
            <ToastProvider> {}
                <AuthProvider>
                    <AppRoutes />
                </AuthProvider>
            </ToastProvider>
        </BrowserRouter>
    );
}

export default App;