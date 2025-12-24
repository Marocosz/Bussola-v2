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
  
  // Drag and Drop (Top/Left Fix)
  const [position, setPosition] = useState(() => ({ 
    x: 20, 
    y: typeof window !== 'undefined' ? window.innerHeight - 90 : 20 
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

    // Só aplica o cooldown se a flag estiver FALSE
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
    // Se a flag estiver ativa, ignora a verificação de timeLeft
    if (!force && timeLeft > 0 && insight && !DISABLE_COOLDOWN) return;

    setLoading(true);
    try {
      const data = await aiService.getInsight(context);
      setInsight(data);
      
      if (data.origem !== 'System') {
        localStorage.setItem(`ai_insight_${context}`, JSON.stringify(data));
        const now = Date.now();
        localStorage.setItem(`ai_last_update_${context}`, now.toString());
        
        // Só define o tempo de espera se a flag estiver FALSE
        if (!DISABLE_COOLDOWN) {
            setTimeLeft(COOLDOWN_MS);
        } else {
            setTimeLeft(0); // Zera o timer no modo DEV
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

  // --- Lógica de Drag and Drop (Mantida igual) ---
  const handleMouseDown = (e) => {
    if (e.target.closest('.ai-content')) return;
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
      const maxX = window.innerWidth - 60;
      const maxY = window.innerHeight - 60;

      setPosition({ 
        x: Math.max(0, Math.min(maxX, newX)), 
        y: Math.max(0, Math.min(maxY, newY)) 
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
      className={`ai-floating-container ${isOpen ? 'open' : ''}`}
      style={{ left: position.x, top: position.y }}
    >
      <div className={`ai-content-wrapper ${isOpen ? 'visible' : ''}`}>
        <div className={`ai-card border-${insight?.cor || 'blue'}`}>
          <div className="ai-header">
            <span className="ai-badge">
              {insight?.origem || 'IA'} Agent
            </span>
            <button 
              className="ai-refresh-btn" 
              onClick={(e) => { e.stopPropagation(); fetchInsight(true); }}
              // No modo DEV, nunca desabilita o botão pelo tempo
              disabled={loading || (timeLeft > 0 && !DISABLE_COOLDOWN)}
              title={timeLeft > 0 && !DISABLE_COOLDOWN ? `Aguarde ${formatTime(timeLeft)}` : "Atualizar Análise"}
            >
              {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : 
               (timeLeft > 0 && !DISABLE_COOLDOWN) ? <span className="timer">{formatTime(timeLeft)}</span> :
               <i className="fa-solid fa-rotate-right"></i>
              }
            </button>
          </div>
          
          <div className="ai-body">
            {!insight && !loading && (
              <div className="ai-empty">
                <p>Clique em atualizar para receber uma análise.</p>
                <button className="btn-start" onClick={() => fetchInsight(true)}>Gerar Análise</button>
              </div>
            )}

            {loading && !insight && (
              <div className="ai-skeleton">
                <div className="line title"></div>
                <div className="line body"></div>
                <div className="line body"></div>
              </div>
            )}

            {insight && (
              <>
                <h3 className="ai-title">
                  <i className={`fa-solid ${getOriginIcon(insight.origem)}`}></i>
                  {insight.titulo}
                </h3>
                <p className="ai-message">{insight.mensagem}</p>
              </>
            )}
          </div>
        </div>
      </div>

      <button 
        className="ai-fab" 
        onMouseDown={handleMouseDown}
        onClick={() => !isDragging && setIsOpen(!isOpen)}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div className="ai-fab-icon">
          <i className="fa-solid fa-sparkles"></i>
        </div>
        {!isOpen && insight && insight.origem !== 'System' && <span className="ping"></span>}
      </button>
    </div>
  );
};