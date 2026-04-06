# Etapa 1: Base
FROM python:3.12-slim

# Evita arquivos .pyc e logs em buffer (melhor para logs do Docker)
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Define diretório de trabalho
WORKDIR /app

# Instala dependências do sistema necessárias para compilar algumas libs (como numpy/pandas se necessário)
ENV TZ=America/Sao_Paulo

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    tzdata \
    # Dependências do Chromium/Playwright
    libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libatspi2.0-0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
    libcairo2 libasound2 libwayland-client0 \
    fonts-noto-color-emoji fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Copia e instala as dependências Python
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Instala Chromium para geração de PDF via Playwright
RUN python -m playwright install chromium

# Copia o código fonte da aplicação
COPY . .

# Expõe a porta 8000
EXPOSE 8000

# Comando de inicialização
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]