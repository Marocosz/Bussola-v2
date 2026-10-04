// Ids que ligam as abas de um Segmented (prop `idBase`) ao painel que elas controlam.
export const segmentedTabId = (idBase, value) => `${idBase}-tab-${value}`;
export const segmentedPanelId = (idBase) => `${idBase}-panel`;

/** Props do painel controlado por um Segmented com `idBase` (role=tabpanel ligado à aba ativa). */
export const segmentedPanelProps = (idBase, value) => ({
    role: 'tabpanel',
    id: segmentedPanelId(idBase),
    'aria-labelledby': segmentedTabId(idBase, value),
});
