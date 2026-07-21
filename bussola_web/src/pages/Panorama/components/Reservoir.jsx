import React from 'react';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

/**
 * "Reservatório" — herói do Panorama, na linguagem da jarra do cofrinho.
 * O tanque representa o Caixa (patrimônio), dividido em Guardado (base, travado
 * nos cofrinhos) e Disponível (livre, com onda no topo). Entradas/saídas do
 * período aparecem como fluxos, e os cofrinhos como mini-jarras alimentadas
 * pelo Guardado. Todos os números vêm de calcular_caixa/resumo (sincronizados).
 */
export function Reservoir({ caixa = 0, disponivel = 0, guardado = 0, receitaPeriodo = 0, despesaPeriodo = 0, cofrinhos = [], privacy = false }) {
  const deficit = caixa <= 0;
  const sobreGuardado = disponivel < 0; // guardou mais do que tem em caixa
  const base = Math.max(caixa, guardado, 1);
  const guardadoFrac = deficit ? 0 : Math.min(1, guardado / base);
  const dispFrac = deficit || sobreGuardado ? 0 : Math.max(0, disponivel / base);

  const blur = privacy ? 'privacy-blur' : '';

  return (
    <div className="reservoir">
      <div className="reservoir-flows">
        <div className="flow-in">
          <span className="flow-label"><i className="fa-solid fa-arrow-down-long"></i> Entrou no período</span>
          <strong className={`flow-val is-in ${blur}`}>{fmt(receitaPeriodo)}</strong>
        </div>
        <div className="flow-out">
          <span className="flow-label"><i className="fa-solid fa-arrow-up-long"></i> Saiu no período</span>
          <strong className={`flow-val is-out ${blur}`}>{fmt(despesaPeriodo)}</strong>
        </div>
      </div>

      <div className="reservoir-main">
        <div className={`reservoir-tank ${deficit ? 'is-deficit' : ''} ${sobreGuardado ? 'is-warning' : ''}`}>
          {!deficit && (
            <>
              <div className="tank-band tank-guardado" style={{ height: `${guardadoFrac * 100}%` }} />
              <div className="tank-band tank-disponivel" style={{ height: `${dispFrac * 100}%`, bottom: `${guardadoFrac * 100}%` }}>
                <span className="tank-wave" />
              </div>
            </>
          )}
          {deficit && <div className="tank-deficit-fill" />}
          <div className="tank-glass" />
          <div className="tank-overlay">
            <span className="tank-caixa-label">Caixa</span>
            <strong className={`tank-caixa-val ${blur}`} style={deficit ? { color: 'var(--cor-vermelho-delete)' } : undefined}>{fmt(caixa)}</strong>
          </div>
        </div>

        <div className="reservoir-figures">
          <div className="fig fig-disp">
            <span className="fig-dot" />
            <span className="fig-label">Disponível</span>
            <strong className={`${blur} ${disponivel < 0 ? 'neg' : ''}`}>{fmt(disponivel)}</strong>
          </div>
          <div className="fig fig-guard">
            <span className="fig-dot" />
            <span className="fig-label">Guardado</span>
            <strong className={blur}>{fmt(guardado)}</strong>
          </div>
          {sobreGuardado && (
            <p className="reservoir-warn"><i className="fa-solid fa-triangle-exclamation"></i> Você guardou mais do que há em caixa — adicione seu saldo inicial em Caixa.</p>
          )}
        </div>
      </div>

      {cofrinhos.length > 0 && (
        <div className="reservoir-jars">
          {cofrinhos.map((m) => {
            const pct = Math.max(0, Math.min(100, m.progresso_pct || 0));
            const cor = m.cor || 'var(--cor-azul-primario)';
            return (
              <div key={m.id} className="mini-jar" title={`${m.nome} · ${pct.toFixed(0)}%`}>
                <div className="mini-jar-glass">
                  <div className="mini-jar-liquid" style={{ height: `${pct}%`, background: cor }} />
                  <i className={`${m.icone || 'fa-solid fa-piggy-bank'} mini-jar-icon`} style={{ color: cor }} />
                </div>
                <span className="mini-jar-name">{m.nome}</span>
                <span className={`mini-jar-val ${blur}`}>{fmt(m.saldo_atual)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
