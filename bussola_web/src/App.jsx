import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar'; // <--- Importado aqui
import { AppRoutes } from './routes'; 
import './assets/styles/global.css'; 

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                {/* A Navbar fica aqui para aparecer em todas as páginas */}
                <Navbar /> 
                
                {/* As rotas renderizam o conteúdo da página abaixo da Navbar */}
                <AppRoutes />
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;