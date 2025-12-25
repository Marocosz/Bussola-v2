import React, { useState, useEffect, useRef } from 'react';
import './styles.css';

export function CitySelector({ value, onChange }) {
    const [inputValue, setInputValue] = useState(value || '');
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    
    // Timeout para não chamar a API a cada letra (Debounce)
    const searchTimeout = useRef(null);
    const wrapperRef = useRef(null);

    // Atualiza o input se o valor externo mudar (ex: ao abrir o drawer)
    useEffect(() => {
        setInputValue(value || '');
    }, [value]);

    // Fecha a lista se clicar fora
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchCities = async (query) => {
        if (!query || query.length < 3) {
            setSuggestions([]);
            return;
        }

        setLoading(true);
        try {
            // API Gratuita do Open-Meteo
            const response = await fetch(
                `https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=5&language=pt&format=json`
            );
            const data = await response.json();

            if (data.results) {
                setSuggestions(data.results);
                setShowSuggestions(true);
            } else {
                setSuggestions([]);
            }
        } catch (error) {
            console.error("Erro ao buscar cidades:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const text = e.target.value;
        setInputValue(text);
        
        // Se o usuário limpar tudo, avisa o pai
        if (text === '') onChange('');

        // Limpa o timer anterior
        if (searchTimeout.current) clearTimeout(searchTimeout.current);

        // Cria um novo timer de 500ms
        searchTimeout.current = setTimeout(() => {
            fetchCities(text);
        }, 500);
    };

    const handleSelectCity = (city) => {
        // Monta uma string bonita: "Uberlândia, MG, Brasil"
        const parts = [
            city.name,
            city.admin1, // Estado/Região
            city.country // País
        ].filter(Boolean); // Remove vazios
        
        const formattedCity = parts.join(', ');

        setInputValue(formattedCity);
        onChange(formattedCity); // Envia para o pai
        setShowSuggestions(false);
        setSuggestions([]);
    };

    return (
        <div className="city-selector-wrapper" ref={wrapperRef}>
            <div className="input-group-icon">
                <input 
                    type="text" 
                    className="form-input city-input"
                    placeholder="Digite para buscar (ex: São Paulo)"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={() => inputValue.length >= 3 && setShowSuggestions(true)}
                />
                {loading && <div className="spinner-mini"></div>}
                {!loading && <i className="fa-solid fa-location-dot input-icon"></i>}
            </div>

            {showSuggestions && suggestions.length > 0 && (
                <ul className="city-suggestions-list">
                    {suggestions.map((city) => (
                        <li key={city.id} onClick={() => handleSelectCity(city)}>
                            <span className="city-name">{city.name}</span>
                            <span className="city-details">
                                {city.admin1 ? `${city.admin1}, ` : ''}{city.country}
                            </span>
                            {city.country_code && (
                                <img 
                                    src={`https://flagcdn.com/16x12/${city.country_code.toLowerCase()}.png`} 
                                    alt={city.country_code}
                                    className="flag-icon"
                                />
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}