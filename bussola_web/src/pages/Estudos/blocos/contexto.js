import { createContext } from 'react';

// Dados do material compartilhados pelos blocos (quantas fontes existem, para as citações [n]).
export const EstudoContexto = createContext({ totalFontes: 0 });
