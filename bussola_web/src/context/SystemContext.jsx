import React, { createContext, useState, useEffect, useContext } from 'react';
import { getSystemConfig } from '../services/api';

const SystemContext = createContext();

export function SystemProvider({ children }) {
    const [config, setConfig] = useState({
        deployment_mode: 'LOADING', // Para mostrar um loading inicial se quiser
        public_registration: true,
        google_login_enabled: false,
        stripe_enabled: false
    });
    
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadConfig() {
            const data = await getSystemConfig();
            setConfig(data);
            setLoading(false);
        }
        loadConfig();
    }, []);

    // Helpers para facilitar o uso no código
    const isSelfHosted = config.deployment_mode === 'SELF_HOSTED';
    const isSaaS = config.deployment_mode === 'SAAS';
    const canRegister = config.public_registration;

    return (
        <SystemContext.Provider value={{ 
            config, 
            loading, 
            isSelfHosted, 
            isSaaS, 
            canRegister 
        }}>
            {children}
        </SystemContext.Provider>
    );
}

export function useSystem() {
    return useContext(SystemContext);
}