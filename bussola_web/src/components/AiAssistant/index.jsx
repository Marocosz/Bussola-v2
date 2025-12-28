import React, { useState, useEffect, useRef } from 'react';
import { aiService } from '../../services/api';
import './styles.css';

const COOLDOWN_HOURS = 3;
const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000;

const DISABLE_COOLDOWN = true; 

export const AiAssistant = ({ context }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0); 
  
  // Novo State: Mostra a hora da última atualização (ex: "14:30")
  const [lastUpdateDisplay, setLastUpdateDisplay] = useState(null);

  // Smart Pos: x='left'|'right', y='up'|'down'
  const [smartPos, setSmartPos] = useState({ x: 'right', y: 'up' });

  const [position, setPosition] = useState(() => ({ 
    x: 30, 
    y: typeof window !== 'undefined' ? window.innerHeight - 100 : 20 
  }));
  
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const requestRef = useRef(null); 

  // Helper: Formata Timestamp para Hora:Minuto
  const formatTimestamp = (ts) => {
    if (!ts) return null;
    const date = new Date(parseInt(ts));
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  useEffect(() => {
    const savedData = localStorage.getItem(`ai_insight_${context}`);
    const lastUpdate = localStorage.getItem(`ai_last_update_${context}`);

    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        setInsight(parsedData);
        
        // Validação básica de formato antigo
        if (!parsedData.suggestions && !parsedData.titulo) {
           // Formato inválido ou antigo, poderia limpar se quisesse
        }
      } catch (e) {
        console.error("Erro ao ler cache local da IA", e);
      }
    }

    if (lastUpdate) {
      // Define a hora visual da última atualização
      setLastUpdateDisplay(formatTimestamp(lastUpdate));

      if (!DISABLE_COOLDOWN) {
        const diff = Date.now() - parseInt(lastUpdate);
        if (diff < COOLDOWN_MS) {
          setTimeLeft(COOLDOWN_MS - diff);
        }
      }
    }
    
    updateSmartPosition(position.x, position.y);
  }, [context]);

  useEffect(() => {
    let timer;
    if (timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => Math.max(0, prev - 1000));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [timeLeft]);

  const fetchInsight = async (force = false) => {
    if (!force && timeLeft > 0 && insight && !DISABLE_COOLDOWN) return;

    setLoading(true);
    try {
      const data = await aiService.getInsight(context);
      setInsight(data);
      
      const now = Date.now();
      localStorage.setItem(`ai_insight_${context}`, JSON.stringify(data));
      localStorage.setItem(`ai_last_update_${context}`, now.toString());
      
      // Atualiza o display de hora imediatamente
      setLastUpdateDisplay(formatTimestamp(now));
      
      if (!DISABLE_COOLDOWN) setTimeLeft(COOLDOWN_MS);
      else setTimeLeft(0);
      
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const updateSmartPosition = (currentX, currentY) => {
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const sideX = currentX > (screenWidth / 2) ? 'left' : 'right';
      const sideY = currentY > (screenHeight / 2) ? 'up' : 'down';
      setSmartPos({ x: sideX, y: sideY });
  };

  const handleMouseDown = (e) => {
    if (e.target.closest('.ai-content-slider')) return; 
    
    const rect = dragRef.current.getBoundingClientRect();
    offsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    if (requestRef.current) cancelAnimationFrame(requestRef.current);

    requestRef.current = requestAnimationFrame(() => {
        const newX = e.clientX - offsetRef.current.x;
        const newY = e.clientY - offsetRef.current.y;
        
        const maxX = window.innerWidth - 60;
        const maxY = window.innerHeight - 60;

        const finalX = Math.max(10, Math.min(maxX, newX));
        const finalY = Math.max(10, Math.min(maxY, newY));

        setPosition({ x: finalX, y: finalY });
        updateSmartPosition(finalX, finalY);
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isDragging]);

  const formatTime = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // --- HELPER FUNCTIONS DE UI ---

  const getDomainIcon = (domain) => {
    switch(domain) {
      case 'nutri': return 'fa-apple-whole';
      case 'coach': return 'fa-dumbbell';
      default: return 'fa-robot';
    }
  };

  const getTypeIcon = (type) => {
    switch(type) {
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

  const positionClass = `pos-${smartPos.x}-${smartPos.y}`;
  const hasSuggestions = insight && insight.suggestions && insight.suggestions.length > 0;

  return (
    <div 
      ref={dragRef}
      className={`ai-floating-container ${isOpen ? 'open' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{ left: position.x, top: position.y }}
      onMouseDown={handleMouseDown}
    >
      <div className={`ai-content-slider ${positionClass}`}>
        <div 
            className={`ai-content-animator ${isOpen ? 'visible' : ''}`}
            onMouseDown={(e) => e.stopPropagation()} 
        >
            <div className="ai-glass-card">
            
            {/* --- HEADER ATUALIZADO --- */}
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
                    <h3>Ritmo Intelligence</h3>
                    <p>Estou pronto para analisar seu Treino e Dieta.</p>
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
                                        {item.domain === 'nutri' ? 'Nutrição' : 'Coach'}
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

                                {/* Removido o botão de ação. Mantido apenas o texto se houver Value */}
                                {item.action && item.action.value && (
                                    <div className="ai-card-footer">
                                        <span className="ai-action-value">
                                            <i className="fa-solid fa-arrow-right-long" style={{marginRight: '8px', opacity: 0.7}}></i>
                                            {item.action.target} ➝ <b>{item.action.value}</b>
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
        </div>
      </div>

      <button 
        className="ai-fab-btn" 
        onClick={() => !isDragging && setIsOpen(!isOpen)}
      >
        <div className="fab-glow"></div>
        <div className="fab-content">
            {isOpen ? (
                <i className="fa-solid fa-xmark"></i>
            ) : (
                <i className="fa-solid fa-robot"></i>
            )}
        </div>
        {!isOpen && hasSuggestions && <span className="notification-dot"></span>}
      </button>
    </div>
  );
};