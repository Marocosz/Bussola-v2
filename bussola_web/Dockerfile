# --- Estágio 1: Build (Node.js) ---
FROM node:20-alpine AS builder

WORKDIR /app

# Instala dependências (usa cache do Docker se package.json não mudar)
COPY package*.json ./
RUN npm ci

# Copia o código e gera o build de produção
COPY . .
RUN npm run build

# --- Estágio 2: Production (Nginx) ---
FROM nginx:alpine

# Copia os arquivos estáticos gerados no estágio anterior para o Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copia nossa configuração customizada do Nginx (vamos criar abaixo)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]