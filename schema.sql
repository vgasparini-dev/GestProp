-- ============================================================
-- GestProp v2.0 — Modelagem de Dados (Cloudflare D1 / SQLite)
-- Confinamento Bovino + Pecuária de Precisão
-- ============================================================
PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------
-- 6. RBAC — Usuários e permissões
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nome          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  senha_hash    TEXT NOT NULL,              -- salted SHA-256: "salt:b64url(SHA-256(salt::senha))" (nunca plaintext)
  role          TEXT NOT NULL DEFAULT 'Vaqueiro'
                CHECK (role IN ('Admin','Zootecnista','Veterinario','Vaqueiro')),
  status        TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo','Inativo')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------
-- 7. Multi-Propriedade (com exclusão segura em 2 etapas)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS propriedades (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nome            TEXT NOT NULL,
  responsavel     TEXT,
  cidade          TEXT,
  estado          TEXT,
  area_ha         REAL,
  ie              TEXT,
  status          TEXT NOT NULL DEFAULT 'Ativa' CHECK (status IN ('Ativa','Arquivada')),
  -- Exclusão segura: etapa 1 gera token; etapa 2 confirma com token + nome
  delete_token    TEXT,
  delete_expira   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  arquivada_em    TEXT
);

CREATE TABLE IF NOT EXISTS usuario_propriedade (
  usuario_id      INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  propriedade_id  INTEGER NOT NULL REFERENCES propriedades(id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, propriedade_id)
);

-- ------------------------------------------------------------
-- Infraestrutura do confinamento
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS currais (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  propriedade_id  INTEGER NOT NULL REFERENCES propriedades(id),
  nome            TEXT NOT NULL,
  capacidade      INTEGER NOT NULL DEFAULT 0,
  tipo            TEXT DEFAULT 'Curral',     -- Curral | Baia | Curral de manejo | Hospital
  obs             TEXT
);

CREATE TABLE IF NOT EXISTS lotes_confinamento (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  propriedade_id    INTEGER NOT NULL REFERENCES propriedades(id),
  curral_id         INTEGER REFERENCES currais(id),
  nome              TEXT NOT NULL,
  data_entrada      TEXT NOT NULL,
  qtd_entrada       INTEGER NOT NULL,
  peso_total_entrada REAL NOT NULL,
  custo_compra_total REAL DEFAULT 0,
  fase_dieta        TEXT DEFAULT 'Adaptacao' CHECK (fase_dieta IN ('Adaptacao','Crescimento','Terminacao')),
  dieta             TEXT,
  ms_dieta          REAL DEFAULT 60,
  peso_alvo_abate   REAL DEFAULT 560,
  gmd_alvo          REAL DEFAULT 1.4,
  rendimento_carcaca REAL DEFAULT 52,        -- % p/ estimativa de carcaça
  status            TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo','Encerrado')),
  data_saida        TEXT,
  qtd_saida         INTEGER,
  peso_total_saida  REAL,
  valor_venda_total REAL,
  obs_saida         TEXT
);

CREATE TABLE IF NOT EXISTS animais (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  propriedade_id  INTEGER NOT NULL REFERENCES propriedades(id),
  lote_conf_id    INTEGER REFERENCES lotes_confinamento(id),
  brinco          TEXT NOT NULL,
  nome            TEXT,
  sexo            TEXT CHECK (sexo IN ('M','F')),
  categoria       TEXT,
  raca            TEXT,
  tipo            TEXT DEFAULT 'Corte',
  data_nasc       TEXT,
  peso_atual      REAL,
  status          TEXT DEFAULT 'Ativo' CHECK (status IN ('Ativo','Hospital','Vendido','Morto')),
  ativo           INTEGER DEFAULT 1,
  obs             TEXT,
  UNIQUE (propriedade_id, brinco)
);

-- ------------------------------------------------------------
-- 3. Pesagem & Desempenho
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pesagens (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  propriedade_id  INTEGER NOT NULL REFERENCES propriedades(id),
  animal_id       INTEGER REFERENCES animais(id),
  brinco          TEXT NOT NULL,
  lote_conf_id    INTEGER REFERENCES lotes_confinamento(id),
  tipo            TEXT DEFAULT 'Intermediaria' CHECK (tipo IN ('Entrada','Intermediaria','Saida')),
  peso            REAL NOT NULL,
  peso_anterior   REAL,
  data            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pesagens_brinco ON pesagens (brinco, data);

-- ------------------------------------------------------------
-- 1. Tratos & Leitura de Cocho com IA (fotos no R2)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tratos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  propriedade_id  INTEGER NOT NULL REFERENCES propriedades(id),
  lote_conf_id    INTEGER NOT NULL REFERENCES lotes_confinamento(id),
  data            TEXT NOT NULL,
  quantidade_kg   REAL NOT NULL,            -- kg matéria natural fornecida
  custo_total     REAL DEFAULT 0,
  sobra_pct       REAL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tratos_lote ON tratos (lote_conf_id, data);

CREATE TABLE IF NOT EXISTS leituras_cocho (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  propriedade_id    INTEGER NOT NULL REFERENCES propriedades(id),
  lote_conf_id      INTEGER NOT NULL REFERENCES lotes_confinamento(id),
  curral_id         INTEGER REFERENCES currais(id),
  data              TEXT NOT NULL,
  horario           TEXT,                    -- antes do 1º trato, etc.
  nota              REAL,                    -- escala 0–4 (0=rapado … 4=sobra excessiva)
  nota_fonte        TEXT DEFAULT 'manual' CHECK (nota_fonte IN ('manual','ia')),
  foto_key          TEXT,                    -- chave do objeto no Cloudflare R2
  ajuste_pct        REAL,                    -- % recomendado p/ próximo fornecimento (+/-)
  justificativa     TEXT,                    -- texto da IA / operador
  registrado_por    INTEGER REFERENCES usuarios(id)
);
CREATE INDEX IF NOT EXISTS idx_cocho_lote ON leituras_cocho (lote_conf_id, data);
CREATE INDEX IF NOT EXISTS idx_cocho_prop ON leituras_cocho (propriedade_id);

-- ------------------------------------------------------------
-- 2. Monitoramento de Água
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agua_registros (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  propriedade_id  INTEGER NOT NULL REFERENCES propriedades(id),
  curral_id       INTEGER REFERENCES currais(id),
  lote_conf_id    INTEGER REFERENCES lotes_confinamento(id),
  data            TEXT NOT NULL,
  limpeza_feita   INTEGER DEFAULT 0,         -- 0/1
  vazao_l_h       REAL,                      -- litros/hora no bebedouro
  pressao_ok      INTEGER DEFAULT 1,         -- 0 = queda de pressão → alerta emergência
  turbidez        TEXT DEFAULT 'Baixa' CHECK (turbidez IN ('Baixa','Media','Alta')),
  ph              REAL,
  temperatura_c   REAL,
  obs             TEXT
);
CREATE INDEX IF NOT EXISTS idx_agua_data ON agua_registros (propriedade_id, data);

-- ------------------------------------------------------------
-- 4. Sanidade — protocolos, aplicações, hospital, óbitos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sanidade_protocolos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  propriedade_id  INTEGER NOT NULL REFERENCES propriedades(id),
  nome            TEXT NOT NULL,             -- Ex: Metafilaxia de Entrada
  tipo            TEXT NOT NULL CHECK (tipo IN ('Vacinacao','Vermifugacao','Metafilaxia','Outro')),
  gatilho         TEXT DEFAULT 'Entrada' CHECK (gatilho IN ('Entrada','DiasAposEntrada','DataFixa','Recorrente')),
  dias_offset     INTEGER DEFAULT 0,         -- p/ DiasAposEntrada / Recorrente
  mes_campanha    TEXT,                      -- p/ DataFixa (ex: "Maio")
  obrigatorio     INTEGER DEFAULT 0,
  itens           TEXT                       -- JSON: [{farmaco, dose, carencia_dias}]
);

CREATE TABLE IF NOT EXISTS sanidade_aplicacoes (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  propriedade_id    INTEGER NOT NULL REFERENCES propriedades(id),
  protocolo_id      INTEGER REFERENCES sanidade_protocolos(id),
  animal_id         INTEGER REFERENCES animais(id),   -- NULL = lote inteiro
  lote_conf_id      INTEGER REFERENCES lotes_confinamento(id),
  lote_nome         TEXT,                              -- p/ lotes de pasto
  tipo              TEXT NOT NULL CHECK (tipo IN ('Vacinacao','Vermifugacao','Metafilaxia','Tratamento')),
  farmaco           TEXT NOT NULL,
  dose              TEXT,
  qtd_animais       INTEGER DEFAULT 1,
  data_aplicacao    TEXT NOT NULL,
  carencia_dias     INTEGER DEFAULT 0,
  data_liberacao    TEXT,                              -- bloqueio de abate até esta data
  custo_total       REAL DEFAULT 0,
  diagnostico       TEXT,                              -- p/ Tratamento (hospital)
  responsavel_id    INTEGER REFERENCES usuarios(id)
);
CREATE INDEX IF NOT EXISTS idx_san_liberacao ON sanidade_aplicacoes (data_liberacao);
CREATE INDEX IF NOT EXISTS idx_san_aplic_prop ON sanidade_aplicacoes (propriedade_id);

CREATE TABLE IF NOT EXISTS sanidade_obitos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  propriedade_id  INTEGER NOT NULL REFERENCES propriedades(id),
  lote_conf_id    INTEGER REFERENCES lotes_confinamento(id),
  brinco          TEXT,
  data            TEXT NOT NULL,
  causa_mortis    TEXT NOT NULL,             -- Ex: Acidose, BRD, timpanismo…
  custo_estimado  REAL DEFAULT 0
);

-- ------------------------------------------------------------
-- 5. Calendário Operacional (tarefas)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tarefas (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  propriedade_id  INTEGER NOT NULL REFERENCES propriedades(id),
  titulo          TEXT NOT NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN ('Sanidade','Pesagem','LimpezaBebedouro','TransicaoDieta','Manejo','Cocho','Outro')),
  data            TEXT NOT NULL,
  lote_conf_id    INTEGER REFERENCES lotes_confinamento(id),
  prioridade      TEXT DEFAULT 'Media' CHECK (prioridade IN ('Baixa','Media','Alta','Critica')),
  status          TEXT DEFAULT 'Pendente' CHECK (status IN ('Pendente','EmAndamento','Concluida','Cancelada')),
  origem          TEXT DEFAULT 'Manual' CHECK (origem IN ('Manual','Protocolo','Alerta')),
  responsavel_id  INTEGER REFERENCES usuarios(id),
  concluida_em    TEXT,
  obs             TEXT
);
CREATE INDEX IF NOT EXISTS idx_tarefas_data ON tarefas (propriedade_id, data, status);

-- ------------------------------------------------------------
-- Alertas operacionais (água, carência, desempenho)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alertas (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  propriedade_id  INTEGER NOT NULL REFERENCES propriedades(id),
  nivel           TEXT NOT NULL CHECK (nivel IN ('Info','Atencao','Emergencia')),
  categoria       TEXT NOT NULL,             -- Agua | Carencia | Cocho | Sanidade | Desempenho
  mensagem        TEXT NOT NULL,
  referencia      TEXT,                      -- ex: "curral:3", "lote:7"
  lido            INTEGER DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------
-- Biblioteca de alimentos / dietas (nutrição)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alimentos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nome            TEXT NOT NULL,
  ms              REAL, pb REAL, preco_kg REAL
);

-- Seed mínimo
-- Senha provisória do admin: admin123 (hash salted SHA-256, salt fixo 'seed-admin-salt').
-- TROCA OBRIGATÓRIA no primeiro acesso (PUT /api/usuarios/1 com nova senha).
INSERT OR IGNORE INTO usuarios (id, nome, email, senha_hash, role, status)
VALUES (1, 'Administrador', 'admin@gestprop.com', 'seed-admin-salt:2R-4TiI3QCdgKuRQjDpMNhj96eMIX_TkTU-e380w-94', 'Admin', 'Ativo');

-- ------------------------------------------------------------
-- Índices tenant-scoped (propriedade_id) e vínculos de usuário
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_currais_prop ON currais (propriedade_id);
CREATE INDEX IF NOT EXISTS idx_lotes_prop ON lotes_confinamento (propriedade_id);
CREATE INDEX IF NOT EXISTS idx_animais_prop ON animais (propriedade_id);
CREATE INDEX IF NOT EXISTS idx_pesagens_prop ON pesagens (propriedade_id);
CREATE INDEX IF NOT EXISTS idx_tratos_prop ON tratos (propriedade_id);
CREATE INDEX IF NOT EXISTS idx_san_obitos_prop ON sanidade_obitos (propriedade_id);
CREATE INDEX IF NOT EXISTS idx_alertas_prop ON alertas (propriedade_id);
CREATE INDEX IF NOT EXISTS idx_usuprop_usuario ON usuario_propriedade (usuario_id);
-- agua_registros e tarefas já possuem índices iniciando por propriedade_id
-- (idx_agua_data e idx_tarefas_data); leituras_cocho e sanidade_aplicacoes
-- receberam idx_cocho_prop / idx_san_aplic_prop junto às tabelas.
