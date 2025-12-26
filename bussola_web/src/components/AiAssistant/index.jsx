import React, { useState, useEffect, useRef } from 'react';
import { aiService } from '../../services/api';
import './styles.css';

const COOLDOWN_HOURS = 3;
const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000;

// [DEV] Flag para desativar o tempo de espera durante o desenvolvimento
const DISABLE_COOLDOWN = true; 

export const AiAssistant = ({ context }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0); 
  
  // Drag and Drop (Posição Inicial: Canto Inferior ESQUERDO)
  const [position, setPosition] = useState(() => ({ 
    x: 30, // Margem esquerda
    y: typeof window !== 'undefined' ? window.innerHeight - 100 : 20 // Margem inferior
  }));
  
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);
  const offsetRef = useRef({ x: 0, y: 0 });

  // Load Inicial
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
  }, [context]);

  // Timer
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
        
        if (!DISABLE_COOLDOWN) {
            setTimeLeft(COOLDOWN_MS);
        } else {
            setTimeLeft(0);
        }
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

  // --- Drag Logic ---
  const handleMouseDown = (e) => {
    // Evita arrastar se clicar dentro do conteúdo (card)
    if (e.target.closest('.ai-content-wrapper')) return;
    
    const rect = dragRef.current.getBoundingClientRect();
    offsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    setIsDragging(true);
  };

  useEffect(() => {
    const handleWindowMouseMove = (e) => {
      if (!isDragging) return;
      const newX = e.clientX - offsetRef.current.x;
      const newY = e.clientY - offsetRef.current.y;
      
      // Limites da tela
      const maxX = window.innerWidth - 70;
      const maxY = window.innerHeight - 70;

      setPosition({ 
        x: Math.max(10, Math.min(maxX, newX)), 
        y: Math.max(10, Math.min(maxY, newY)) 
      });
    };

    const handleWindowMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
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

  return (
    <div 
      ref={dragRef}
      className={`ai-floating-container ${isOpen ? 'open' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{ left: position.x, top: position.y }}
      onMouseDown={handleMouseDown}
    >
      {/* Área do Conteúdo (Popup ao LADO DIREITO) */}
      <div 
        className={`ai-content-wrapper ${isOpen ? 'visible' : ''}`}
        onMouseDown={(e) => e.stopPropagation()} 
      >
        <div className="ai-glass-card">
          <div className="ai-glass-header">
            <div className="ai-agent-identity">
              <div className="ai-agent-icon">
                <i className={`fa-solid ${getOriginIcon(insight?.origem)}`}></i>
              </div>
              <div className="ai-agent-info">
                <span className="ai-agent-name">{insight?.origem || 'System'} Agent</span>
                <span className="ai-agent-status">{loading ? 'Processando...' : 'Online'}</span>
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
                <h3 className="ai-insight-title">{insight.titulo}</h3>
                <div className="ai-insight-text">
                  {insight.mensagem}
                </div>
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

      {/* Botão Flutuante (FAB) */}
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
        {/* Dot de notificação só aparece se tiver insight e estiver fechado */}
        {!isOpen && insight && insight.origem !== 'System' && <span className="notification-dot"></span>}
      </button>
    </div>
  );
};