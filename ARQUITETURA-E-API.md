# GestProp v2.0 — Modelagem de Dados & API

Sistema de gestão de **Confinamento Bovino** com Pecuária de Precisão, rodando em
**Cloudflare Workers** (API REST) + **D1** (SQL/SQLite) + **R2** (fotos de cocho) +
**DeepSeek** (`deepseek-v4-pro` / `deepseek-v4-flash`) como consultor técnico de IA.
> Os modelos legados `deepseek-chat` e `deepseek-reasoner` foram **descontinuados em 24/07/2026** e não devem mais ser usados.

---

## 1. Arquitetura

```
┌────────────────────┐   HTTPS    ┌──────────────────────────────────┐
│  React + Vite (SPA)│ ─────────► │  Cloudflare Worker (gestprop-api) │
│  src/              │  REST/JSON │  src/index.js                     │
└────────────────────┘            │   ├─ D1 (SQLite relacional)       │
                                  │   ├─ R2 (fotos de cocho)          │
                                  │   ├─ DeepSeek API (proxy seguro)  │
                                  │   └─ RBAC por papel               │
                                  └──────────────────────────────────┘
```

- A chave da DeepSeek pode ser configurada de duas formas: (a) **no front**, em Configurações → Assistente IA (fica no navegador do usuário, chamada direta à API oficial, modelo padrão `deepseek-v4-pro` com fallback automático para `deepseek-v4-flash` em HTTP 400/404); ou (b) **no Worker** via `wrangler secret put DEEPSEEK_API_KEY` (usada quando o front não tem chave local).
- Fotos de cocho sobem como `multipart/form-data` direto para o R2 via Worker.
- Sem `VITE_API_URL`, o front opera em modo local (dados em localStorage/Firebase).

### Segurança (Worker)

- **`AUTH_SECRET` é obrigatório**: sem ele, login e rotas autenticadas falham com `500` explícito (não há fallback inseguro).
- **Senhas**: salted SHA-256 no formato `salt:hash` (salt = UUID aleatório, hash = `b64url(SHA-256(salt::senha))`). Hashes no formato legado continuam válidos para login (retrocompatibilidade).
- **Seed admin**: `admin@gestprop.com` / senha provisória **`admin123`** — **troca obrigatória no primeiro acesso** (`PUT /api/usuarios/1` com nova `senha`).
- **Multi-tenant**: toda rota com `propriedade_id` (`pid`) valida o acesso via tabela `usuario_propriedade` — Admin acessa tudo; demais roles só acessam propriedades vinculadas (usuários sem nenhum vínculo, de instalações antigas/single-tenant, mantêm acesso por compatibilidade). Rotas por `id` derivam a propriedade do registro antes de autorizar.
- **CRUD genérico**: colunas passam por **whitelist por tabela** (chaves fora da lista → `400`); em tabelas tenant-scoped o `propriedade_id` é **forçado ao `pid` da requisição** (o valor enviado pelo cliente é ignorado). `alertas` é **somente leitura** (`POST/PUT/DELETE` → `403`). `GET /api/usuarios` é restrito a Admin e **nunca retorna `senha_hash`**.

## 2. Modelagem de Dados (D1 / SQL)

Schema completo em [`worker/schema.sql`](../worker/schema.sql). Resumo das entidades:

| Tabela | Finalidade | Campos-chave |
|---|---|---|
| `usuarios` | Contas e papéis RBAC | `email`, `senha_hash`, `role` (`Admin`/`Zootecnista`/`Veterinario`/`Vaqueiro`), `status` |
| `propriedades` | Multi-fazenda + exclusão segura | `status` (`Ativa`/`Arquivada`), `delete_token`, `delete_expira` |
| `usuario_propriedade` | Vínculo N:N usuário ↔ fazenda | — |
| `currais` | Currais/baias/hospital | `nome`, `capacidade`, `tipo` |
| `lotes_confinamento` | Entrada/saída de lotes | `qtd_entrada`, `peso_total_entrada`, `fase_dieta` (`Adaptacao`/`Crescimento`/`Terminacao`), `ms_dieta`, `peso_alvo_abate`, `rendimento_carcaca` |
| `animais` | Rebanho individual | `brinco` (único por fazenda), `lote_conf_id`, `status` (`Ativo`/`Hospital`/`Vendido`/`Morto`) |
| `pesagens` | Entrada/intermediária/saída | `tipo`, `peso`, `peso_anterior`, `data` |
| `tratos` | Fornecimento diário | `quantidade_kg` (MN), `custo_total`, `sobra_pct` |
| `leituras_cocho` | Leitura de cocho c/ IA | `nota` (0–4), `nota_fonte` (`manual`/`ia`), `foto_key` (R2), `ajuste_pct` |
| `agua_registros` | Monitoramento de água | `limpeza_feita`, `vazao_l_h`, `pressao_ok`, `turbidez`, `ph`, `temperatura_c` |
| `sanidade_protocolos` | Protocolos sanitários | `tipo` (`Vacinacao`/`Vermifugacao`/`Metafilaxia`), `gatilho`, `dias_offset`, `itens` (JSON) |
| `sanidade_aplicacoes` | Aplicações e hospital | `tipo`, `farmaco`, `carencia_dias`, `data_liberacao` (**bloqueio de abate**), `custo_total`, `diagnostico` |
| `sanidade_obitos` | Mortalidade por causa | `causa_mortis`, `custo_estimado` |
| `tarefas` | Calendário operacional | `tipo` (`Sanidade`/`Pesagem`/`LimpezaBebedouro`/`TransicaoDieta`/`Manejo`/`Cocho`), `prioridade`, `status`, `origem` (`Manual`/`Protocolo`/`Alerta`) |
| `alertas` | Alertas automáticos | `nivel` (`Info`/`Atencao`/`Emergencia`), `categoria`, `lido` |
| `alimentos` | Biblioteca nutricional | `ms`, `pb`, `preco_kg` |

### Métricas zootécnicas (calculadas — não armazenadas)

| Métrica | Fórmula |
|---|---|
| GMD | `(pesoAtual − pesoEntrada) / diasConfinamento` |
| Conversão alimentar | `kg MS consumida / kg de ganho` |
| Eficiência alimentar | `kg de ganho / kg MS` (inverso da CA) |
| CMS/cabeça/dia | `kg MS total / dias / cabeças` |
| Carcaça estimada | `pesoAtual × rendimento%` (padrão 52 %) e `/15` para arrobas |
| Morbidade | `tratamentos / cabeças × 100` |
| Mortalidade | `óbitos / cabeças × 100`, estratificada por `causa_mortis` |

### Escala de cocho (0–4) → ajuste de trato

| Nota | Leitura | Ajuste |
|---|---|---|
| 0 | Cocho rapado | **+7,5 %** |
| 1 | Sobra limpa (rastro) | **+5 %** |
| 2 | Ideal (2–5 % de sobra) | **0 %** |
| 3 | Sobra 5–10 % | **−5 %** |
| 4 | Sobra excessiva (>10 %) | **−10 %** |

Reforço de tendência: 3 leituras seguidas ≤ 1 → +2,5 p.p.; 3 seguidas ≥ 3 → −2,5 p.p.
(Espelhado em `worker/src/index.js` e `src/lib/zoo.js`.)

## 3. Endpoints da API (REST)

Base: `https://<worker>.workers.dev` — autenticação `Authorization: Bearer <token>`.

### Auth
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/login` | Login (`email`, `senha`) → `{ token, usuario }` |
| GET | `/api/health` | Health-check |

### IA (DeepSeek)
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/ai/chat` | Chat consultor. Body: `mensagem`, `contexto`, `historico[]`, `model?` |
| POST | `/api/ai/analise` | Resumo executivo dos indicadores. `profunda: true` → `deepseek-v4-pro` com `max_tokens` 8000 (thinking consome tokens) |

### Cocho (R2 + IA)
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/cocho/upload?propriedade_id={id}` | Multipart: `foto`, `lote_conf_id`, `data`, `nota?` → grava no R2 + D1, retorna `ajuste_pct`. Sem o query param, aceita `propriedade_id` como campo do form |
| GET | `/api/cocho/foto/{key}?token={token}` | Stream da foto a partir do R2. Aceita o token **via query string** (para `<img src>`, que não envia header) ou via `Authorization` |
| GET | `/api/cocho/leituras?propriedade_id=` | Histórico de leituras |
| POST | `/api/cocho/analisar` | `{ lote_conf_id }` → regra determinística + parecer DeepSeek da série |

### Água
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/agua/registros` | Registra verificação; gera **alertas automáticos** (pressão, pH, turbidez, temperatura, vazão) |
| GET | `/api/agua/registros?propriedade_id=` | Histórico |

### Desempenho & Sanidade
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/pesagens/desempenho?lote_conf_id=` | GMD, CA, EA, CMS, carcaça e arrobas estimadas |
| GET | `/api/sanidade/indicadores?propriedade_id=` | Morbidade, mortalidade por causa, custo medicamento/cabeça |
| GET | `/api/sanidade/carencia?propriedade_id=` | Lotes/animais **bloqueados para abate** (carência vigente) |

### Calendário / Tarefas
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/tarefas?propriedade_id=&de=&ate=` | Lista por período (visões mensal/semanal/kanban no front) |
| POST | `/api/tarefas/{id}/concluir` | Conclui tarefa |
| POST | `/api/tarefas/gerar-de-protocolos` | Gera tarefas a partir dos protocolos `DiasAposEntrada` dos lotes ativos |

### Propriedades — exclusão segura (2 etapas)
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/propriedades/{id}/excluir` | Etapa 1: `{ nome_confirmacao, modo }` (`arquivamento`/`expurgo`) → retorna `token` (válido 15 min) |
| DELETE | `/api/propriedades/{id}` | Etapa 2: **body JSON** (`Content-Type: application/json`) `{ token, modo }` → arquiva ou expurga todos os dados vinculados (expurgo também apaga as fotos do R2 em `cocho/{id}/` e os vínculos em `usuario_propriedade`) |

### CRUD genérico
`GET/POST /api/<colecao>` · `PUT/DELETE /api/<colecao>/{id}` para:
`currais`, `lotes_confinamento`, `animais`, `pesagens`, `tratos`, `sanidade_protocolos`,
`sanidade_aplicacoes`, `sanidade_obitos`, `tarefas`, `alimentos`, `usuarios`, `propriedades`.

- Colunas validadas por **whitelist** (fora da lista → `400`); tabelas tenant-scoped forçam `propriedade_id = pid`.
- `alertas`: **somente leitura** (`POST/PUT/DELETE` → `403`).
- `usuarios`: `GET` restrito a Admin, sem `senha_hash`; `POST/PUT` Admin-only (`senha` em plain é convertida para hash salted).

## 4. RBAC — Matriz de permissões (Worker)

| Escopo | Admin | Zootecnista | Veterinario | Vaqueiro |
|---|:-:|:-:|:-:|:-:|
| Leitura geral | ✔ | ✔ | ✔ | ✔ |
| Cocho / tratos | ✔ | ✔ | — | ✔ |
| Água | ✔ | ✔ | ✔ | ✔ |
| Pesagens | ✔ | ✔ | ✔ | — |
| Sanidade (protocolos/aplicações/óbitos) | ✔ | — | ✔ | — |
| Tarefas | ✔ | ✔ | ✔ | ✔ |
| IA (DeepSeek) | ✔ | ✔ | ✔ | — |
| Usuários / propriedades / exclusões | ✔ | — | — | — |

## 5. Deploy (Cloudflare)

```bash
cd worker
wrangler d1 create gestprop-db                 # copie o database_id p/ wrangler.toml
wrangler d1 execute gestprop-db --file=schema.sql
wrangler r2 bucket create gestprop-cocho
wrangler secret put DEEPSEEK_API_KEY           # https://platform.deepseek.com
wrangler secret put AUTH_SECRET
wrangler deploy
# No front: definir VITE_API_URL=https://gestprop-api.<conta>.workers.dev
```

DNS, SSL/TLS e CDN seguem pela rede Cloudflare (proxied) no domínio da aplicação.
