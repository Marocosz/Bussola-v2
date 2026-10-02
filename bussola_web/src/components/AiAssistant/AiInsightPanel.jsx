import React from 'react';
import { DISABLE_COOLDOWN, useAiInsight } from './useAiInsight';

const formatTime = (ms) => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

const getDomainIcon = (domain) => {
  switch (domain) {
    case 'nutri': return 'fa-apple-whole';
    case 'coach': return 'fa-dumbbell';
    case 'registros': return 'fa-list-check';
    case 'roteiro': return 'fa-calendar-day';
    default: return 'fa-robot';
  }
};

const getDomainLabel = (domain) => {
  switch (domain) {
    case 'nutri': return 'Nutrição';
    case 'coach': return 'Treino';
    case 'registros': return 'Gestão';
    case 'roteiro': return 'Agenda AI';
    default: return 'AI';
  }
};

const getTypeIcon = (type) => {
  switch (type) {
    case 'critical': return 'fa-circle-exclamation';
    case 'error': return 'fa-bug';
    case 'warning': return 'fa-triangle-exclamation';
    case 'praise':
    case 'compliment': return 'fa-trophy';
    case 'tip': return 'fa-lightbulb';
    case 'suggestion': return 'fa-shuffle';
    default: return 'fa-info-circle';
  }
};

const getAgentLabel = (agentSource) => {
  if (!agentSource) return 'Agente';
  // Formata snake_case para Title Case (ex: flow_architect -> Flow Architect)
  return agentSource.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const renderFormattedText = (text) => {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

/** Card de insights de IA (usado no balão do desktop e no sheet do celular). */
export function AiInsightPanel({ ai }) {
  const { insight, loading, timeLeft, lastUpdateDisplay, hasSuggestions, fetchInsight } = ai;
  return (
          <div className="ai-glass-card">

            {/* --- HEADER --- */}
            <div className="ai-glass-header">
              <div className="ai-agent-identity">
                <div className="ai-agent-icon">
                  <i className="fa-solid fa-brain"></i>
                </div>
                <div className="ai-agent-info">
                  <span className="ai-agent-name">Performance Head</span>

                  <div className="ai-status-wrapper">
                    <span className="ai-agent-status">
                      {loading ? 'Sincronizando...' : 'Online'}
                    </span>

                    {/* Badge de última atualização */}
                    {!loading && lastUpdateDisplay && (
                      <span className="ai-last-update-badge">
                        <i className="fa-regular fa-clock"></i> {lastUpdateDisplay}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                className="ai-action-btn refresh"
                onClick={() => fetchInsight(true)}
                disabled={loading || (timeLeft > 0 && !DISABLE_COOLDOWN)}
                title="Nova Análise"
              >
                {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-rotate"></i>}
              </button>
            </div>

            <div className="ai-glass-body">
              {!insight && !loading && (
                <div className="ai-empty-state">
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                  <h3>Intelligence Hub</h3>
                  <p>Estou pronto para analisar seu perfil.</p>
                  <button className="ai-btn-primary" onClick={() => fetchInsight(true)}>
                    Gerar Análise Completa
                  </button>
                </div>
              )}

              {loading && !insight && (
                <div className="ai-skeleton-loader">
                  <div className="sk-line title"></div>
                  <div className="sk-card"></div>
                  <div className="sk-card"></div>
                  <div className="sk-card"></div>
                </div>
              )}

              {hasSuggestions && (
                <div className="ai-feed">
                  <div className="ai-feed-header">
                    <span>{insight.suggestions.length} Insights Encontrados</span>
                  </div>

                  {insight.suggestions.map((item) => (
                    <div key={item.id} className={`ai-suggestion-card type-${item.type} severity-${item.severity}`}>
                      <div className="ai-card-header">
                        <div className="ai-card-badges">
                          <span className={`ai-domain-badge ${item.domain}`}>
                            <i className={`fa-solid ${getDomainIcon(item.domain)}`}></i>
                            {getDomainLabel(item.domain)}
                          </span>
                          <span className="ai-agent-badge">
                            {getAgentLabel(item.agent_source)}
                          </span>
                        </div>
                        <div className="ai-card-severity"></div>
                      </div>

                      <div className="ai-card-content">
                        <div className="ai-card-title-row">
                          <div className={`ai-card-icon-box ${item.type}`}>
                            <i className={`fa-solid ${getTypeIcon(item.type)}`}></i>
                          </div>
                          <h4 className="ai-card-title">{item.title}</h4>
                        </div>

                        <p className="ai-card-text">
                          {renderFormattedText(item.content)}
                        </p>

                        {item.action && item.action.value && (
                          <div className="ai-card-footer">
                            <span className="ai-action-value">
                              <i className="fa-solid fa-arrow-right-long" style={{ marginRight: '8px', opacity: 0.7 }}></i>
                              {item.action.target} <b style={{ marginLeft: '5px' }}>{item.action.value}</b>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {(timeLeft > 0 && !DISABLE_COOLDOWN) && (
                    <div className="ai-cooldown-bar">
                      <i className="fa-regular fa-clock"></i>
                      <span>Próxima análise em: {formatTime(timeLeft)}</span>
                    </div>
                  )}
                </div>
              )}

              {insight && insight.suggestions && insight.suggestions.length === 0 && (
                <div className="ai-empty-state">
                  <i className="fa-regular fa-thumbs-up"></i>
                  <p>Tudo parece estar em ordem!</p>
                  <p className="sub-text">Nenhuma observação crítica encontrada no momento.</p>
                </div>
              )}

            </div>
          </div>
  );
}

/** Versão autocontida para o sheet da topbar mobile. */
export function AiMobilePanel({ context }) {
  const ai = useAiInsight(context);
  return <AiInsightPanel ai={ai} />;
}
