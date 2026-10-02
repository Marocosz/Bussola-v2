import { useState, useEffect, useCallback } from 'react';
import { aiService } from '../../services/api';
import { logger } from '../../utils/logger';

const COOLDOWN_MS = 3 * 60 * 60 * 1000;
// Em produção, isso deve ser false para evitar spam na API LLM
export const DISABLE_COOLDOWN = true;

const formatTimestamp = (ts) => {
    if (!ts) return null;
    const d = new Date(parseInt(ts, 10));
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

function lerCache(context) {
    try {
        const raw = localStorage.getItem(`ai_insight_${context}`);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        logger.error('Erro ao ler cache local da IA', { error: String(e) });
        return null;
    }
}

function restanteCooldown(context) {
    if (DISABLE_COOLDOWN) return 0;
    const last = localStorage.getItem(`ai_last_update_${context}`);
    if (!last) return 0;
    return Math.max(0, COOLDOWN_MS - (Date.now() - parseInt(last, 10)));
}

/** Estado do insight de IA de um contexto (financas, roteiro, registros, ritmo). */
export function useAiInsight(context) {
    const [insight, setInsight] = useState(() => lerCache(context));
    const [loading, setLoading] = useState(false);
    const [timeLeft, setTimeLeft] = useState(() => restanteCooldown(context));
    const [lastUpdateDisplay, setLastUpdateDisplay] = useState(
        () => formatTimestamp(localStorage.getItem(`ai_last_update_${context}`)),
    );

    useEffect(() => {
        if (timeLeft <= 0) return undefined;
        const timer = setInterval(() => setTimeLeft((prev) => Math.max(0, prev - 1000)), 1000);
        return () => clearInterval(timer);
    }, [timeLeft]);

    const fetchInsight = useCallback(async (force = false) => {
        if (!force && timeLeft > 0 && insight && !DISABLE_COOLDOWN) return;
        setLoading(true);
        try {
            const data = await aiService.getInsight(context);
            setInsight(data);
            const now = Date.now();
            localStorage.setItem(`ai_insight_${context}`, JSON.stringify(data));
            localStorage.setItem(`ai_last_update_${context}`, now.toString());
            setLastUpdateDisplay(formatTimestamp(now));
            setTimeLeft(DISABLE_COOLDOWN ? 0 : COOLDOWN_MS);
        } catch (error) {
            logger.error('Erro inesperado', { error: String(error) });
        } finally {
            setLoading(false);
        }
    }, [context, insight, timeLeft]);

    const hasSuggestions = Boolean(insight?.suggestions?.length);
    return { insight, loading, timeLeft, lastUpdateDisplay, hasSuggestions, fetchInsight };
}
