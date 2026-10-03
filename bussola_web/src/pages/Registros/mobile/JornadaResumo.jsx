import { contarHabitosHoje, formatarDataJornada } from '../jornadaUtils';

/** Linha da Jornada no celular: "data · X de Y hábitos" com barra de progresso. */
export function JornadaResumo({ habitos }) {
    const { feitos, total, pct } = contarHabitosHoje(habitos);
    // Há hábitos, mas nenhum cai hoje: sem contagem "0 de 0" e sem barra (aria-valuemax seria 0).
    if (!total) {
        return (
            <div className="reg-m-jornada">
                <p className="reg-m-jornada-linha">{formatarDataJornada()} · Nenhum hábito hoje</p>
            </div>
        );
    }
    return (
        <div className="reg-m-jornada">
            <p className="reg-m-jornada-linha">
                {formatarDataJornada()} · {feitos} de {total} {total === 1 ? 'hábito' : 'hábitos'}
            </p>
            <div
                className="reg-m-jornada-barra"
                role="progressbar"
                aria-label="Hábitos de hoje"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={feitos}
            >
                <div className="reg-m-jornada-fill" style={{ width: `${pct}%` }}></div>
            </div>
        </div>
    );
}
