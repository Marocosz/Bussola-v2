import { useSyncExternalStore } from 'react';

export const MOBILE_QUERY = '(max-width: 768px)';
export const TABLET_QUERY = '(min-width: 769px) and (max-width: 1024px)';

const subscribers = {};

function subscribeFor(query) {
    if (!subscribers[query]) {
        subscribers[query] = (callback) => {
            const mql = window.matchMedia(query);
            mql.addEventListener('change', callback);
            return () => mql.removeEventListener('change', callback);
        };
    }
    return subscribers[query];
}

export function useMediaQuery(query) {
    return useSyncExternalStore(
        subscribeFor(query),
        () => window.matchMedia(query).matches,
        () => false,
    );
}

export const useIsMobile = () => useMediaQuery(MOBILE_QUERY);
export const useIsTablet = () => useMediaQuery(TABLET_QUERY);