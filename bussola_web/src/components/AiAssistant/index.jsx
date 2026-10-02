import React, { useState, useEffect, useRef } from 'react';
import './styles.css';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useAiInsight } from './useAiInsight';
import { AiInsightPanel } from './AiInsightPanel';

function calcSmartPos(currentX, currentY) {
  if (typeof window === 'undefined') return { x: 'left', y: 'up' };
  return {
    x: currentX > (window.innerWidth / 2) ? 'left' : 'right',
    y: currentY > (window.innerHeight / 2) ? 'up' : 'down',
  };
}

export const AiAssistant =({ context }) => {
  const isMobile = useIsMobile();
  const ai = useAiInsight(context);
  const { hasSuggestions } = ai;

  const [isOpen, setIsOpen] = useState(false);

  // Padrão: canto inferior direito (60px de botão + 30px de margem)
  const [position, setPosition] = useState(() => ({
    x: typeof window !== 'undefined' ? window.innerWidth - 90 : 20,
    y: typeof window !== 'undefined' ? window.innerHeight - 100 : 20
  }));

  // Smart Pos: x='left'|'right', y='up'|'down' (inicial derivado da posição padrão)
  const [smartPos, setSmartPos] = useState(() => calcSmartPos(position.x, position.y));

  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const requestRef = useRef(null);

  const updateSmartPosition = (currentX, currentY) => {
    setSmartPos(calcSmartPos(currentX, currentY));
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

  const positionClass = `pos-${smartPos.x}-${smartPos.y}`;

  // No celular o assistente abre pelo botão da topbar (sheet de tela cheia).
  if (isMobile) return null;

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
          <AiInsightPanel ai={ai} />
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
