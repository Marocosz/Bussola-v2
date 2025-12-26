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

  useEffect(() => {
    const savedData = localStorage.getItem(`ai_insight_${context}`);
    const lastUpdate = localStorage.getItem(`ai_last_update_${context}`);

    if (savedData) {
      const parsedData = JSON.parse(savedData);
      setInsight(parsedData);
      if (parsedData.origem === 'System') {
          setTimeLeft(0);
          return;
      }
    }

    if (lastUpdate && !DISABLE_COOLDOWN) {
      const diff = Date.now() - parseInt(lastUpdate);
      if (diff < COOLDOWN_MS) {
        setTimeLeft(COOLDOWN_MS - diff);
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
      
      if (data.origem !== 'System') {
        localStorage.setItem(`ai_insight_${context}`, JSON.stringify(data));
        const now = Date.now();
        localStorage.setItem(`ai_last_update_${context}`, now.toString());
        
        if (!DISABLE_COOLDOWN) setTimeLeft(COOLDOWN_MS);
        else setTimeLeft(0);
      } else {
        localStorage.removeItem(`ai_insight_${context}`);
        localStorage.removeItem(`ai_last_update_${context}`);
        setTimeLeft(0); 
      }
      
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

  const getOriginIcon = (origin) => {
    const icons = {
      Bio: "fa-heart-pulse",
      Coach: "fa-dumbbell",
      Nutri: "fa-apple-whole",
      System: "fa-robot",
      Finance: "fa-coins",
      Agenda: "fa-calendar-check"
    };
    return icons[origin] || "fa-lightbulb";
  };

  // Helper para cor do status
  const getStatusColor = (status) => {
      switch(status) {
          case 'critico': return '#ef4444'; // Red
          case 'atencao': return '#f59e0b'; // Orange
          case 'otimo': return '#22c55e'; // Green
          default: return '#3b82f6'; // Blue (OK)
      }
  };

  const positionClass = `pos-${smartPos.x}-${smartPos.y}`;

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
            <div className="ai-glass-header">
                <div className="ai-agent-identity">
                <div className="ai-agent-icon">
                    <i className="fa-solid fa-robot"></i>
                </div>
                <div className="ai-agent-info">
                    <span className="ai-agent-name">Performance Head</span>
                    <span className="ai-agent-status">{loading ? 'Sincronizando...' : 'Online'}</span>
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
                    <p>Estou pronto para analisar seus dados.</p>
                    <button className="ai-btn-primary" onClick={() => fetchInsight(true)}>
                    Gerar Insight
                    </button>
                </div>
                )}

                {loading && !insight && (
                <div className="ai-skeleton-loader">
                    <div className="sk-line title"></div>
                    <div className="sk-line text"></div>
                    <div className="sk-line text"></div>
                    <div className="sk-line text short"></div>
                </div>
                )}

                {insight && (
                <div className="ai-insight-content">
                    {/* Cabeçalho Resumido */}
                    <div className="ai-summary-box">
                        <h3 className="ai-insight-title">{insight.titulo}</h3>
                        <p className="ai-insight-text">{insight.mensagem}</p>
                    </div>

                    {/* Lista de Agentes (Se disponível) */}
                    {insight.agentes && insight.agentes.length > 0 && (
                        <div className="ai-agents-grid">
                            {insight.agentes.map((agent, idx) => (
                                <div key={idx} className="ai-agent-mini-card">
                                    <div className="ai-mini-icon" style={{color: getStatusColor(agent.status)}}>
                                        <i className={`fa-solid ${getOriginIcon(agent.nome)}`}></i>
                                    </div>
                                    <div className="ai-mini-content">
                                        <div className="ai-mini-header">
                                            <span className="ai-mini-name">{agent.nome}</span>
                                            <span className="ai-mini-status" style={{color: getStatusColor(agent.status)}}>
                                                {agent.status === 'otimo' ? 'Excelente' : agent.status.toUpperCase()}
                                            </span>
                                        </div>
                                        <p className="ai-mini-text">{agent.resumo}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {(timeLeft > 0 && !DISABLE_COOLDOWN) && (
                    <div className="ai-cooldown-bar">
                        <i className="fa-regular fa-clock"></i>
                        <span>Próxima análise em: {formatTime(timeLeft)}</span>
                    </div>
                    )}
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
        {!isOpen && insight && insight.origem !== 'System' && <span className="notification-dot"></span>}
      </button>
    </div>
  );
};