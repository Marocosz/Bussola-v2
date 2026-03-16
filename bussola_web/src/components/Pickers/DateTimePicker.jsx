import { DatePicker } from './DatePicker';
import { TimePicker } from './TimePicker';
import './pickers.css';

/**
 * DateTimePicker — composição de DatePicker + TimePicker.
 *
 * Props:
 *   value       — string "YYYY-MM-DDTHH:MM" ou vazio
 *   onChange(e) — chamado com { target: { name, value } }  (mesmo padrão dos outros pickers)
 *   name        — string (opcional)
 *   label       — string (opcional, renderizado acima do conjunto)
 *   required    — bool
 */
export function DateTimePicker({
    value,
    onChange,
    name,
    label,
    required = false,
}) {
    // Decompõe o valor combinado
    const dateVal = value ? value.split('T')[0] : '';
    const timeVal = value ? (value.split('T')[1] || '').slice(0, 5) : '';

    const emit = (newDate, newTime) => {
        const d = newDate ?? dateVal;
        const t = newTime ?? timeVal;
        // Só emite valor completo se data estiver preenchida; senão limpa
        const combined = d ? `${d}T${t || '00:00'}` : '';
        onChange({ target: { name, value: combined } });
    };

    const handleDateChange = (e) => emit(e.target.value, null);
    const handleTimeChange = (e) => emit(null, e.target.value);

    return (
        <div className="pk-datetime-wrapper">
            {label && <label className="pk-label">{label}</label>}

            <div className="pk-datetime-fields">
                <DatePicker
                    value={dateVal}
                    onChange={handleDateChange}
                    placeholder="Data..."
                    required={required}
                />
                <TimePicker
                    value={timeVal}
                    onChange={handleTimeChange}
                    placeholder="Hora..."
                    required={required && !!dateVal}
                />
            </div>
        </div>
    );
}
