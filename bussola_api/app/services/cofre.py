"""
=======================================================================================
ARQUIVO: cofre.py (Serviço de Cofre de Senhas)
=======================================================================================

OBJETIVO:
    Gerenciar o ciclo de vida de segredos e senhas armazenados.
    Responsável central pela aplicação da criptografia (Encryption at Rest) antes
    que os dados sejam persistidos no banco de dados.

PARTE DO SISTEMA:
    Backend / Service Layer / Security.

RESPONSABILIDADES:
    1. Criptografar dados sensíveis (Write) usando chave simétrica (Fernet).
    2. Descriptografar dados apenas sob demanda explícita (Read).
    3. Gerenciar metadados dos segredos (CRUD).
    4. Garantir isolamento estrito de dados por usuário (user_id).

COMUNICAÇÃO:
    - Config: Utiliza settings.ENCRYPTION_KEY para inicializar o cipher.
    - Models: Manipula a entidade Segredo.
    - Cryptography: Dependência direta da lib 'cryptography'.

=======================================================================================
"""

from sqlalchemy.orm import Session
from cryptography.fernet import Fernet
from app.core.config import settings
from app.models.cofre import Segredo
from app.schemas.cofre import SegredoCreate, SegredoUpdate

# --------------------------------------------------------------------------------------
# INICIALIZAÇÃO DO MOTOR CRIPTOGRÁFICO
# --------------------------------------------------------------------------------------
# Tenta carregar a chave de criptografia simétrica (Fernet/AES) das variáveis de ambiente.
# Se a chave falhar ou não existir, o serviço inicia, mas operações de escrita/leitura
# de senhas falharão de forma controlada.
try:
    cipher_suite = Fernet(settings.ENCRYPTION_KEY.encode())
except Exception as e:
    print(f"AVISO: Falha ao carregar ENCRYPTION_KEY no CofreService: {e}")
    cipher_suite = None

class CofreService:
    
    def get_all(self, db: Session, user_id: int):
        """
        Retorna a lista de segredos do usuário.

        DECISÃO TÉCNICA (PERFORMANCE & SEGURANÇA):
        Este método retorna apenas os METADADOS (título, serviço, notas).
        A coluna 'valor_criptografado' é retornada do banco, mas não é descriptografada aqui.
        Isso evita o custo computacional de descriptografar uma lista inteira e 
        reduz a superfície de ataque (senhas não ficam em memória desnecessariamente).
        """
        return db.query(Segredo).filter(Segredo.user_id == user_id).order_by(Segredo.servico, Segredo.titulo).all()

    def create(self, db: Session, dados: SegredoCreate, user_id: int):
        """
        Cria um novo registro de segredo aplicando criptografia no valor.

        FLUXO DE SEGURANÇA:
        1. Verifica se o motor de criptografia (cipher_suite) está ativo.
        2. Criptografa a senha em texto plano (dados.valor) -> bytes criptografados.
        3. Persiste apenas o hash criptografado no banco.

        Erro Crítico:
            Levanta exceção se a ENCRYPTION_KEY não estiver configurada, 
            impedindo salvar dados inseguros.
        """
        # 1. Criptografia Explícita
        valor_encrypted = ""
        if cipher_suite and dados.valor:
            # Fernet encrypt: Retorna bytes, decodificamos para string para salvar no banco (VARCHAR)
            valor_encrypted = cipher_suite.encrypt(dados.valor.encode()).decode()
        else:
            # Fallback de segurança: Impede operação se não houver chave
            if not cipher_suite:
                raise Exception("Encryption Key não configurada. Não é possível salvar segredos.")
        
        # 2. Persistência
        # Mapeia o valor criptografado para o campo físico '_valor_criptografado' (via alias no model)
        novo = Segredo(
            titulo=dados.titulo,
            servico=dados.servico,
            notas=dados.notas,
            data_expiracao=dados.data_expiracao,
            valor_criptografado=valor_encrypted, 
            user_id=user_id
        )
        
        db.add(novo)
        db.commit()
        db.refresh(novo)
        return novo

    def update(self, db: Session, id: int, dados: SegredoUpdate, user_id: int):
        """
        Atualiza metadados de um segredo existente.
        
        REGRA DE NEGÓCIO:
        Este método NÃO atualiza a senha (valor). A alteração de senha sensível
        geralmente requer um fluxo específico de re-criptografia, mantendo
        esta função focada apenas em dados cadastrais (título, notas, validade).
        """
        segredo = db.query(Segredo).filter(Segredo.id == id, Segredo.user_id == user_id).first()
        if not segredo: return None

        if dados.titulo is not None: segredo.titulo = dados.titulo
        if dados.servico is not None: segredo.servico = dados.servico
        if dados.notas is not None: segredo.notas = dados.notas
        
        # Lógica para tratar campos opcionais (Date) via Pydantic
        if dados.model_fields_set and 'data_expiracao' in dados.model_dump(exclude_unset=True):
             segredo.data_expiracao = dados.data_expiracao
        elif dados.data_expiracao is not None:
             segredo.data_expiracao = dados.data_expiracao

        db.commit()
        db.refresh(segredo)
        return segredo

    def delete(self, db: Session, id: int, user_id: int):
        # Garante que o usuário só pode deletar seus próprios segredos
        segredo = db.query(Segredo).filter(Segredo.id == id, Segredo.user_id == user_id).first()
        if segredo:
            db.delete(segredo)
            db.commit()
            return True
        return False

    def get_decrypted_value(self, db: Session, id: int, user_id: int) -> str:
        """
        Recupera e DESCRIPTOGRAFA a senha original.

        CONTEXTO DE USO:
        Chamado exclusivamente pela rota de 'Revelar Senha' ou 'Copiar para Área de Transferência'.
        É o único ponto do sistema onde o dado plano é reconstruído.

        Retorno:
            str: A senha original ou uma mensagem de erro controlada se a chave
                 tiver mudado ou estiver incorreta.
        """
        segredo = db.query(Segredo).filter(Segredo.id == id, Segredo.user_id == user_id).first()
        
        if not segredo: 
            return None
            
        if cipher_suite and segredo.valor_criptografado:
            try:
                # Tenta reverter a criptografia usando a chave atual
                return cipher_suite.decrypt(segredo.valor_criptografado.encode()).decode()
            except Exception:
                # Ocorre se a ENCRYPTION_KEY mudou ou os dados estão corrompidos
                return "!! ERRO DE DESCRIPTOGRAFIA !!"
        
        return "!! ERRO: SISTEMA SEM CHAVE !!"

cofre_service = CofreService()