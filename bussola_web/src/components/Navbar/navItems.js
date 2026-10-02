// Fonte única dos módulos da navegação (sidebar, barra inferior, "Mais" e topbar).
// `bottom`: aparece direto na barra inferior do celular; os demais vão no "Mais".
// `aiContext`: contexto do AiAssistant da página (habilita o robô na topbar).
export const NAV_ITEMS = [
    { to: '/home', icone: 'fa-house', rotulo: 'Início' },
    { to: '/panorama', icone: 'fa-chart-pie', rotulo: 'Panorama', bottom: true },
    { to: '/financas', icone: 'fa-wallet', rotulo: 'Provisões', bottom: true, aiContext: 'financas' },
    { to: '/agenda', icone: 'fa-calendar-days', rotulo: 'Roteiro', bottom: true, aiContext: 'roteiro' },
    { to: '/registros', icone: 'fa-book', rotulo: 'Registros', bottom: true, aiContext: 'registros' },
    { to: '/estudos', icone: 'fa-graduation-cap', rotulo: 'Estudos' },
    { to: '/ritmo', icone: 'fa-dumbbell', rotulo: 'Ritmo', aiContext: 'ritmo' },
    { to: '/cofre', icone: 'fa-vault', rotulo: 'Cofre' },
];

export function findNavItem(pathname) {
    if (pathname === '/') return NAV_ITEMS[0];
    return NAV_ITEMS.find((i) => pathname === i.to || pathname.startsWith(`${i.to}/`)) ?? null;
}
