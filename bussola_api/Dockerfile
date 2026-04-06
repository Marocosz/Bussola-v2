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
    && rm -rf /var/lib/apt/lists/*

# Copia e instala as dependências Python
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Instala Chromium para geração de PDF via Playwright
RUN python -m playwright install --with-deps chromium

# Copia o código fonte da aplicação
COPY . .

# Expõe a porta 8000
EXPOSE 8000

# Comando de inicialização
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]