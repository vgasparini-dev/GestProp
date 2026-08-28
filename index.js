// ============================================================
// GestProp — API Worker (Cloudflare Workers + D1 + R2 + DeepSeek)
// ============================================================

// ---------- RBAC: matriz de permissões ----------
// Admin        → tudo
// Zootecnista  → nutrição, cocho, desempenho, calendário, leituras gerais
// Veterinario  → sanidade completa, leituras gerais
// Vaqueiro     → tratos, leitura de cocho, água, tarefas do dia
const PERMISSOES = {
  Admin:        ['*'],
  Zootecnista:  ['read', 'cocho.write', 'tratos.write', 'pesagens.write', 'tarefas.write', 'agua.write', 'ai'],
  Veterinario:  ['read', 'sanidade.write', 'pesagens.write', 'tarefas.write', 'agua.write', 'ai'],
  Vaqueiro:     ['read', 'cocho.write', 'tratos.write', 'agua.write', 'tarefas.write'],
};
const pode = (user, escopo) => {
  const p = PERMISSOES[user?.role] || [];
  return p.includes('*') || p.includes(escopo);
};

// ---------- Utilidades HTTP ----------
const cors = (env) => ({
  'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
});
const json = (data, status, env) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', ...cors(env) },
});
const err = (env, msg, status = 400) => json({ error: msg }, status, env);

// ---------- Auth: token HMAC (JWT-lite) ----------
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const ub64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

// Falha fechada: sem AUTH_SECRET não há como assinar/verificar tokens.
function getAuthSecret(env) {
  if (!env.AUTH_SECRET) throw new Error('AUTH_SECRET não configurado');
  return env.AUTH_SECRET;
}
async function hmacKey(env) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(getAuthSecret(env)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function signToken(env, payload, ttlHoras = 12) {
  const body = { ...payload, exp: Date.now() + ttlHoras * 3600e3 };
  const data = b64(new TextEncoder().encode(JSON.stringify(body)));
  const sig = b64(await crypto.subtle.sign('HMAC', await hmacKey(env), new TextEncoder().encode(data)));
  return `${data}.${sig}`;
}
async function verifyToken(env, token) {
  try {
    const [data, sig] = String(token || '').split('.');
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(env), ub64(sig), new TextEncoder().encode(data));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(ub64(data)));
    return payload.exp > Date.now() ? payload : null;
  } catch { return null; }
}

// ---------- Senhas: salted SHA-256 ----------
// Formato novo: "salt:hash" — salt = UUID, hash = b64url(SHA-256(salt + '::' + senha)).
// NÃO usa AUTH_SECRET (permite seed determinístico e rotação do secret sem invalidar senhas).
// Formato legado (retrocompatível): b64url(SHA-256(AUTH_SECRET + '::' + senha)).
async function hashSenha(senha) {
  const salt = crypto.randomUUID();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}::${senha}`));
  return `${salt}:${b64(digest)}`;
}
async function hashSenhaLegado(env, senha) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${env.AUTH_SECRET || 'dev'}::${senha}`));
  return b64(digest);
}
async function verificarSenha(env, senha, armazenado) {
  const s = String(armazenado || '');
  if (s.includes(':')) {
    const idx = s.indexOf(':');
    const salt = s.slice(0, idx);
    const h = s.slice(idx + 1);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}::${senha}`));
    return b64(digest) === h;
  }
  return s === await hashSenhaLegado(env, senha);
}

// ---------- Multi-tenant: enforcement por propriedade ----------
// Admin acessa tudo. Demais roles: se o usuário possui vínculos em
// usuario_propriedade, o pid precisa estar entre eles; se não possui NENHUM
// vínculo (instalação antiga / single-tenant), permite (compatibilidade).
async function assertAcessoPropriedade(env, user, pid) {
  if (!pid) return false;
  if (user.role === 'Admin') return true;
  const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM usuario_propriedade WHERE usuario_id = ?').bind(user.uid).first();
  if (!total || !total.n) return true;
  const m = await env.DB.prepare('SELECT 1 AS ok FROM usuario_propriedade WHERE usuario_id = ? AND propriedade_id = ?').bind(user.uid, pid).first();
  return !!m;
}

// ---------- DeepSeek ----------
// Modelos válidos: deepseek-v4-pro (padrão) e deepseek-v4-flash (fallback em 400/404).
// Os legados deepseek-chat / deepseek-reasoner foram descontinuados em 24/07/2026.
async function deepseek(env, { messages, model, temperature = 0.3, max_tokens = 1200 }) {
  if (!env.DEEPSEEK_API_KEY) return { error: 'DEEPSEEK_API_KEY não configurada (wrangler secret put DEEPSEEK_API_KEY).' };
  const call = (mdl) => fetch(`${env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({ model: mdl, messages, temperature, max_tokens, stream: false }),
  });
  let res = await call(model || env.DEEPSEEK_MODEL || 'deepseek-v4-pro');
  if (res.status === 400 || res.status === 404) res = await call('deepseek-v4-flash'); // fallback p/ modelo oficial
  if (!res.ok) return { error: `DeepSeek HTTP ${res.status}: ${(await res.text()).slice(0, 300)}` };
  const data = await res.json();
  return { text: data.choices?.[0]?.message?.content || 'Sem resposta.', usage: data.usage };
}
const SYS_PECUARISTA = 'Você é um consultor técnico sênior de confinamento bovino no Brasil (zootecnia, nutrição de precisão, sanidade e gestão). Responda em PT-BR, de forma objetiva, com números quando possível e recomendações operacionais práticas.';

// ---------- Regras zootécnicas: nota de cocho → ajuste de trato ----------
// Escala 0–4: 0 = cocho rapado | 1 = sobra limpa (rastro) | 2 = sobra 2–5% (ideal alto)
//             3 = sobra 5–10% | 4 = sobra excessiva >10%
function ajustePorCocho(nota, historico = []) {
  const tabela = { 0: +7.5, 1: +5, 2: 0, 3: -5, 4: -10 };
  let ajuste = tabela[Math.round(Math.min(4, Math.max(0, nota)))] ?? 0;
  // Persistência: 3+ leituras seguidas na mesma direção amplificam o ajuste
  const ult = historico.slice(-3).map((h) => h.nota);
  if (ult.length === 3 && ult.every((n) => n <= 1)) ajuste += 2.5;
  if (ult.length === 3 && ult.every((n) => n >= 3)) ajuste -= 2.5;
  return ajuste;
}

// ---------- Alertas automáticos de água ----------
function avaliarAgua(r) {
  const alertas = [];
  if (Number(r.pressao_ok) === 0) alertas.push(['Emergencia', `Queda de pressão no bebedouro (curral ${r.curral_id || '?'}). Verificar bomba/registro imediatamente.`]);
  if (r.ph != null && (r.ph < 6.5 || r.ph > 8.5)) alertas.push(['Emergencia', `pH fora da faixa de potabilidade (${r.ph}). Faixa aceitável: 6,5–8,5.`]);
  if (r.turbidez === 'Alta') alertas.push(['Atencao', 'Turbidez ALTA na água — risco de redução de consumo hídrico e GMD.']);
  if (r.temperatura_c != null && r.temperatura_c > 30) alertas.push(['Atencao', `Água a ${r.temperatura_c}°C — acima de 30°C reduz consumo e desempenho.`]);
  if (r.vazao_l_h != null && r.vazao_l_h < 300) alertas.push(['Atencao', `Vazão baixa (${r.vazao_l_h} L/h) — insuficiente para lotes grandes.`]);
  return alertas;
}

// ---------- CRUD genérico: whitelist de colunas por tabela ----------
// (derivada do schema.sql — chaves fora da whitelist são rejeitadas com 400)
const COLUNAS = {
  currais:             ['propriedade_id', 'nome', 'capacidade', 'tipo', 'obs'],
  lotes_confinamento:  ['propriedade_id', 'curral_id', 'nome', 'data_entrada', 'qtd_entrada', 'peso_total_entrada', 'custo_compra_total', 'fase_dieta', 'dieta', 'ms_dieta', 'peso_alvo_abate', 'gmd_alvo', 'rendimento_carcaca', 'status', 'data_saida', 'qtd_saida', 'peso_total_saida', 'valor_venda_total', 'obs_saida'],
  animais:             ['propriedade_id', 'lote_conf_id', 'brinco', 'nome', 'sexo', 'categoria', 'raca', 'tipo', 'data_nasc', 'peso_atual', 'status', 'ativo', 'obs'],
  pesagens:            ['propriedade_id', 'animal_id', 'brinco', 'lote_conf_id', 'tipo', 'peso', 'peso_anterior', 'data'],
  tratos:              ['propriedade_id', 'lote_conf_id', 'data', 'quantidade_kg', 'custo_total', 'sobra_pct'],
  sanidade_protocolos: ['propriedade_id', 'nome', 'tipo', 'gatilho', 'dias_offset', 'mes_campanha', 'obrigatorio', 'itens'],
  sanidade_aplicacoes: ['propriedade_id', 'protocolo_id', 'animal_id', 'lote_conf_id', 'lote_nome', 'tipo', 'farmaco', 'dose', 'qtd_animais', 'data_aplicacao', 'carencia_dias', 'data_liberacao', 'custo_total', 'diagnostico', 'responsavel_id'],
  sanidade_obitos:     ['propriedade_id', 'lote_conf_id', 'brinco', 'data', 'causa_mortis', 'custo_estimado'],
  tarefas:             ['propriedade_id', 'titulo', 'tipo', 'data', 'lote_conf_id', 'prioridade', 'status', 'origem', 'responsavel_id', 'concluida_em', 'obs'],
  alertas:             ['propriedade_id', 'nivel', 'categoria', 'mensagem', 'referencia', 'lido', 'created_at'],
  alimentos:           ['nome', 'ms', 'pb', 'preco_kg'],
  usuarios:            ['nome', 'email', 'senha_hash', 'role', 'status'],
  propriedades:        ['nome', 'responsavel', 'cidade', 'estado', 'area_ha', 'ie', 'status'],
};

// ---------- Router ----------
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    if (method === 'OPTIONS') return new Response(null, { headers: cors(env) });

    try {
      // ------- público -------
      if (path === '/api/health') return json({ ok: true, ts: Date.now() }, 200, env);
      if (path === '/api/auth/login' && method === 'POST') {
        if (!env.AUTH_SECRET) return err(env, 'AUTH_SECRET não configurado no Worker (wrangler secret put AUTH_SECRET).', 500);
        const { email, senha } = await request.json();
        const u = await env.DB.prepare('SELECT * FROM usuarios WHERE email = ? AND status = ?').bind(String(email).toLowerCase(), 'Ativo').first();
        if (!u || !(await verificarSenha(env, senha, u.senha_hash))) return err(env, 'Credenciais inválidas.', 401);
        const token = await signToken(env, { uid: u.id, nome: u.nome, email: u.email, role: u.role });
        return json({ token, usuario: { id: u.id, nome: u.nome, email: u.email, role: u.role } }, 200, env);
      }

      // ------- foto de cocho: aceita token via ?token= (para <img src>) ou header -------
      // Fica ANTES do gate geral porque o navegador não envia Authorization em <img>.
      if (path.startsWith('/api/cocho/foto/') && method === 'GET') {
        if (!env.AUTH_SECRET) return err(env, 'AUTH_SECRET não configurado no Worker (wrangler secret put AUTH_SECRET).', 500);
        const t = url.searchParams.get('token') || (request.headers.get('Authorization') || '').replace(/^Bearer /, '');
        const u = await verifyToken(env, t);
        if (!u) return err(env, 'Não autenticado.', 401);
        const key = decodeURIComponent(path.replace('/api/cocho/foto/', ''));
        const obj = await env.COCHO_BUCKET.get(key);
        if (!obj) return err(env, 'Foto não encontrada.', 404);
        return new Response(obj.body, { headers: { 'Content-Type': obj.httpMetadata?.contentType || 'image/jpeg', ...cors(env) } });
      }

      // ------- autenticado -------
      if (!env.AUTH_SECRET) return err(env, 'AUTH_SECRET não configurado no Worker (wrangler secret put AUTH_SECRET).', 500);
      const user = await verifyToken(env, (request.headers.get('Authorization') || '').replace(/^Bearer /, ''));
      if (!user) return err(env, 'Não autenticado.', 401);

      // Body: JSON apenas quando Content-Type é application/json (qualquer método com
      // body, inclusive DELETE). Multipart NUNCA é consumido aqui — as rotas multipart
      // chamam request.formData() localmente.
      const ct = (request.headers.get('Content-Type') || '').toLowerCase();
      let body = {};
      if (!['GET', 'HEAD'].includes(method) && ct.includes('application/json')) {
        body = await request.json().catch(() => ({}));
      }
      const pid = Number(url.searchParams.get('propriedade_id') || body.propriedade_id || 0);

      // Helper local: exige pid válido + acesso do usuário à propriedade.
      const exigirAcessoPid = async () => {
        if (!pid) return err(env, 'Parâmetro propriedade_id obrigatório.', 422);
        if (!(await assertAcessoPropriedade(env, user, pid))) return err(env, 'Sem acesso a esta propriedade.', 403);
        return null;
      };

      // ===== IA (DeepSeek) =====
      if (path === '/api/ai/chat' && method === 'POST') {
        if (!pode(user, 'ai')) return err(env, 'Sem permissão.', 403);
        const msgs = [
          { role: 'system', content: SYS_PECUARISTA },
          ...(body.contexto ? [{ role: 'system', content: `Contexto operacional da fazenda:\n${body.contexto}` }] : []),
          ...(body.historico || []).map((m) => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text })),
          { role: 'user', content: body.mensagem },
        ];
        const r = await deepseek(env, { messages: msgs, model: body.model });
        return r.error ? err(env, r.error, 502) : json({ resposta: r.text, usage: r.usage }, 200, env);
      }
      if (path === '/api/ai/analise' && method === 'POST') {
        if (!pode(user, 'ai')) return err(env, 'Sem permissão.', 403);
        // Análise profunda: deepseek-v4-pro com max_tokens maior (thinking consome tokens)
        const r = await deepseek(env, {
          model: body.profunda ? 'deepseek-v4-pro' : undefined,
          max_tokens: body.profunda ? 8000 : 2000,
          messages: [
            { role: 'system', content: SYS_PECUARISTA },
            { role: 'user', content: `Gere um resumo executivo com pontos positivos, riscos e 3 ações recomendadas a partir destes indicadores:\n${JSON.stringify(body.indicadores)}` },
          ],
        });
        return r.error ? err(env, r.error, 502) : json({ resposta: r.text }, 200, env);
      }

      // ===== Cocho: upload de foto (R2) + leitura =====
      if (path === '/api/cocho/upload' && method === 'POST') {
        if (!pode(user, 'cocho.write')) return err(env, 'Sem permissão.', 403);
        const form = await request.formData();
        // propriedade_id: query string (?propriedade_id=) com fallback para campo do form
        const pidUp = pid || Number(form.get('propriedade_id') || 0);
        if (!pidUp) return err(env, 'propriedade_id obrigatório (query string ou campo do form).', 422);
        if (!(await assertAcessoPropriedade(env, user, pidUp))) return err(env, 'Sem acesso a esta propriedade.', 403);
        const file = form.get('foto');
        if (!file || !file.type?.startsWith('image/')) return err(env, 'Arquivo de imagem obrigatório.');
        const key = `cocho/${pidUp}/${form.get('lote_conf_id')}/${Date.now()}-${crypto.randomUUID()}.jpg`;
        await env.COCHO_BUCKET.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
        const nota = form.get('nota') != null && form.get('nota') !== '' ? Number(form.get('nota')) : null;
        const hist = await env.DB.prepare(
          'SELECT nota FROM leituras_cocho WHERE lote_conf_id = ? AND propriedade_id = ? ORDER BY data DESC, id DESC LIMIT 3'
        ).bind(Number(form.get('lote_conf_id')), pidUp).all();
        const ajuste = nota != null ? ajustePorCocho(nota, hist.results || []) : null;
        const ins = await env.DB.prepare(
          `INSERT INTO leituras_cocho (propriedade_id, lote_conf_id, curral_id, data, horario, nota, nota_fonte, foto_key, ajuste_pct, justificativa, registrado_por)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`
        ).bind(pidUp, Number(form.get('lote_conf_id')), form.get('curral_id') ? Number(form.get('curral_id')) : null,
          form.get('data'), form.get('horario') || null, nota, form.get('nota_fonte') || 'manual',
          key, ajuste, form.get('justificativa') || null, user.uid).run();
        return json({ id: ins.meta.last_row_id, foto_key: key, ajuste_pct: ajuste }, 201, env);
      }
      if (path === '/api/cocho/leituras' && method === 'GET') {
        const negado = await exigirAcessoPid(); if (negado) return negado;
        const rows = await env.DB.prepare(
          'SELECT * FROM leituras_cocho WHERE propriedade_id = ? ORDER BY data DESC, id DESC LIMIT 200'
        ).bind(pid).all();
        return json(rows.results || [], 200, env);
      }
      if (path === '/api/cocho/analisar' && method === 'POST') {
        if (!pode(user, 'cocho.write')) return err(env, 'Sem permissão.', 403);
        if (pid && !(await assertAcessoPropriedade(env, user, pid))) return err(env, 'Sem acesso a esta propriedade.', 403);
        // DeepSeek interpreta a série de leituras e recomenda o ajuste de trato
        const loteId = Number(body.lote_conf_id);
        const hist = pid
          ? await env.DB.prepare(
              'SELECT data, nota, ajuste_pct, justificativa FROM leituras_cocho WHERE lote_conf_id = ? AND propriedade_id = ? ORDER BY data DESC, id DESC LIMIT 14'
            ).bind(loteId, pid).all()
          : await env.DB.prepare(
              'SELECT data, nota, ajuste_pct, justificativa FROM leituras_cocho WHERE lote_conf_id = ? ORDER BY data DESC, id DESC LIMIT 14'
            ).bind(loteId).all();
        const serie = (hist.results || []).reverse();
        const ultima = serie[serie.length - 1];
        const ajuste = ultima?.nota != null ? ajustePorCocho(ultima.nota, serie.slice(0, -1)) : 0;
        const r = await deepseek(env, { messages: [
          { role: 'system', content: SYS_PECUARISTA },
          { role: 'user', content: `Série de leituras de cocho (escala 0=rapado … 4=sobra excessiva), mais antiga → mais recente:\n${JSON.stringify(serie)}\nO motor de regras sugere ajuste de ${ajuste}% no fornecimento. Valide tecnicamente, aponte tendência de consumo e dê a recomendação final de ajuste (em %) com justificativa curta.` },
        ] });
        return json({ ajuste_regra: ajuste, parecer_ia: r.text || r.error }, 200, env);
      }

      // ===== Água =====
      if (path === '/api/agua/registros' && method === 'POST') {
        if (!pode(user, 'agua.write')) return err(env, 'Sem permissão.', 403);
        const negado = await exigirAcessoPid(); if (negado) return negado;
        const r = body;
        const ins = await env.DB.prepare(
          `INSERT INTO agua_registros (propriedade_id, curral_id, lote_conf_id, data, limpeza_feita, vazao_l_h, pressao_ok, turbidez, ph, temperatura_c, obs)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`
        ).bind(pid, r.curral_id || null, r.lote_conf_id || null, r.data, r.limpeza_feita ? 1 : 0,
          r.vazao_l_h ?? null, r.pressao_ok === false ? 0 : 1, r.turbidez || 'Baixa', r.ph ?? null, r.temperatura_c ?? null, r.obs || null).run();
        const alertasAgua = avaliarAgua(r);
        for (const [nivel, mensagem] of alertasAgua) {
          await env.DB.prepare('INSERT INTO alertas (propriedade_id, nivel, categoria, mensagem, referencia) VALUES (?,?,?,?,?)')
            .bind(pid, nivel, 'Agua', mensagem, `agua:${ins.meta.last_row_id}`).run();
        }
        return json({ id: ins.meta.last_row_id, alertas: alertasAgua.length }, 201, env);
      }
      if (path === '/api/agua/registros' && method === 'GET') {
        const negado = await exigirAcessoPid(); if (negado) return negado;
        const rows = await env.DB.prepare('SELECT * FROM agua_registros WHERE propriedade_id = ? ORDER BY data DESC, id DESC LIMIT 200').bind(pid).all();
        return json(rows.results || [], 200, env);
      }

      // ===== Pesagens & desempenho =====
      if (path === '/api/pesagens/desempenho' && method === 'GET') {
        const lote = await env.DB.prepare('SELECT * FROM lotes_confinamento WHERE id = ?').bind(Number(url.searchParams.get('lote_conf_id'))).first();
        if (!lote) return err(env, 'Lote não encontrado.', 404);
        if (!(await assertAcessoPropriedade(env, user, lote.propriedade_id))) return err(env, 'Sem acesso a esta propriedade.', 403);
        // Guards contra divisão por zero / datas inválidas (nunca Infinity/NaN no JSON)
        if (!lote.qtd_entrada || lote.qtd_entrada <= 0) return err(env, 'Lote sem quantidade de entrada válida (qtd_entrada > 0).', 422);
        const dtEntrada = new Date(lote.data_entrada);
        if (Number.isNaN(dtEntrada.getTime())) return err(env, 'Data de entrada do lote inválida.', 422);
        const encerrado = lote.status === 'Encerrado';
        if (encerrado && (!lote.qtd_saida || lote.qtd_saida <= 0)) return err(env, 'Lote encerrado sem quantidade de saída válida (qtd_saida > 0).', 422);
        const dtFim = lote.data_saida ? new Date(lote.data_saida) : new Date();
        let dias = Math.round((dtFim - dtEntrada) / 86400000);
        if (!Number.isFinite(dias) || dias < 1) dias = 1;
        const tratos = await env.DB.prepare('SELECT COALESCE(SUM(quantidade_kg),0) kg FROM tratos WHERE lote_conf_id = ?').bind(lote.id).first();
        const pesagens = await env.DB.prepare('SELECT * FROM pesagens WHERE lote_conf_id = ? ORDER BY data').bind(lote.id).all();
        const pesoEnt = lote.peso_total_entrada / lote.qtd_entrada;
        const ult = (pesagens.results || []).slice(-1)[0];
        const pesoAtual = encerrado && lote.peso_total_saida ? lote.peso_total_saida / lote.qtd_saida
          : ult ? ult.peso : null;
        const gmd = pesoAtual != null ? (pesoAtual - pesoEnt) / dias : null;
        const kgMS = tratos.kg * (lote.ms_dieta || 60) / 100;
        const cabecas = encerrado && lote.qtd_saida ? lote.qtd_saida : lote.qtd_entrada;
        const ganhoTotal = pesoAtual != null ? (pesoAtual - pesoEnt) * cabecas : null;
        const rc = lote.rendimento_carcaca ?? 52;
        return json({
          dias, pesoEntradaMedio: pesoEnt, pesoAtualMedio: pesoAtual,
          gmd, conversaoAlimentar: ganhoTotal > 0 ? kgMS / ganhoTotal : null,
          eficienciaAlimentar: kgMS > 0 && ganhoTotal != null ? ganhoTotal / kgMS : null,
          cmsCabDia: kgMS / dias / lote.qtd_entrada,
          carcacaEstimadaKg: pesoAtual != null ? pesoAtual * rc / 100 : null,
          arrobasEstimadas: pesoAtual != null ? pesoAtual * rc / 100 / 15 : null,
        }, 200, env);
      }

      // ===== Sanidade: indicadores, carência =====
      if (path === '/api/sanidade/indicadores' && method === 'GET') {
        const negado = await exigirAcessoPid(); if (negado) return negado;
        const lotes = await env.DB.prepare("SELECT * FROM lotes_confinamento WHERE propriedade_id = ? AND status = 'Ativo'").bind(pid).all();
        const cabecas = (lotes.results || []).reduce((a, l) => a + l.qtd_entrada, 0) || 1;
        const trat = await env.DB.prepare("SELECT COUNT(*) n, COALESCE(SUM(custo_total),0) custo FROM sanidade_aplicacoes WHERE propriedade_id = ? AND tipo = 'Tratamento'").bind(pid).first();
        const obitos = await env.DB.prepare('SELECT causa_mortis, COUNT(*) n FROM sanidade_obitos WHERE propriedade_id = ? GROUP BY causa_mortis').bind(pid).all();
        const nObitos = (obitos.results || []).reduce((a, o) => a + o.n, 0);
        return json({
          morbidade_pct: (trat.n / cabecas) * 100,
          mortalidade_pct: (nObitos / cabecas) * 100,
          mortalidade_por_causa: obitos.results || [],
          custo_medicamento_cabeca: trat.custo / cabecas,
          cabecas_base: cabecas,
        }, 200, env);
      }
      if (path === '/api/sanidade/carencia' && method === 'GET') {
        const negado = await exigirAcessoPid(); if (negado) return negado;
        const rows = await env.DB.prepare(
          `SELECT * FROM sanidade_aplicacoes WHERE propriedade_id = ? AND data_liberacao IS NOT NULL AND data_liberacao > date('now')`
        ).bind(pid).all();
        return json({ bloqueados: rows.results || [], total: (rows.results || []).length }, 200, env);
      }

      // ===== Propriedades: exclusão segura em 2 etapas =====
      if (path.match(/^\/api\/propriedades\/\d+\/excluir$/) && method === 'POST') {
        if (!pode(user, '*')) return err(env, 'Apenas Admin.', 403);
        const id = Number(path.split('/')[3]);
        const prop = await env.DB.prepare('SELECT * FROM propriedades WHERE id = ?').bind(id).first();
        if (!prop) return err(env, 'Propriedade não encontrada.', 404);
        if (body.nome_confirmacao !== prop.nome) return err(env, 'Nome de confirmação não confere.', 422);
        const token = crypto.randomUUID();
        await env.DB.prepare("UPDATE propriedades SET delete_token = ?, delete_expira = datetime('now','+15 minutes') WHERE id = ?").bind(token, id).run();
        return json({ etapa: 1, token, expira_em_minutos: 15, modo: body.modo === 'expurgo' ? 'expurgo' : 'arquivamento' }, 200, env);
      }
      if (path.match(/^\/api\/propriedades\/\d+$/) && method === 'DELETE') {
        if (!pode(user, '*')) return err(env, 'Apenas Admin.', 403);
        const id = Number(path.split('/')[3]);
        // Expiração conferida no SQL (fuso/formato do SQLite), não em string JS
        const prop = await env.DB.prepare(
          "SELECT * FROM propriedades WHERE id = ? AND delete_token = ? AND delete_expira > datetime('now')"
        ).bind(id, String(body.token || '')).first();
        if (!prop) return err(env, 'Token inválido ou expirado. Refaça a etapa 1.', 422);
        if (body.modo === 'expurgo') {
          // Remove também as fotos do R2 (prefixo cocho/<id>/)
          let cursor;
          do {
            const lista = await env.COCHO_BUCKET.list({ prefix: `cocho/${id}/`, cursor });
            if (lista.objects.length) await env.COCHO_BUCKET.delete(lista.objects.map((o) => o.key));
            cursor = lista.truncated ? lista.cursor : undefined;
          } while (cursor);
          const tabelas = ['leituras_cocho', 'tratos', 'agua_registros', 'pesagens', 'sanidade_aplicacoes', 'sanidade_obitos', 'sanidade_protocolos', 'tarefas', 'alertas', 'animais', 'lotes_confinamento', 'currais'];
          for (const t of tabelas) await env.DB.prepare(`DELETE FROM ${t} WHERE propriedade_id = ?`).bind(id).run();
          await env.DB.prepare('DELETE FROM usuario_propriedade WHERE propriedade_id = ?').bind(id).run();
          await env.DB.prepare('DELETE FROM propriedades WHERE id = ?').bind(id).run();
          return json({ excluida: true, modo: 'expurgo' }, 200, env);
        }
        await env.DB.prepare("UPDATE propriedades SET status = 'Arquivada', arquivada_em = datetime('now'), delete_token = NULL WHERE id = ?").bind(id).run();
        return json({ excluida: true, modo: 'arquivamento' }, 200, env);
      }

      // ===== Tarefas (calendário) =====
      if (path === '/api/tarefas' && method === 'GET') {
        const negado = await exigirAcessoPid(); if (negado) return negado;
        const rows = await env.DB.prepare(
          'SELECT * FROM tarefas WHERE propriedade_id = ? AND data BETWEEN ? AND ? ORDER BY data'
        ).bind(pid, url.searchParams.get('de') || '2000-01-01', url.searchParams.get('ate') || '2100-01-01').all();
        return json(rows.results || [], 200, env);
      }
      if (path.match(/^\/api\/tarefas\/\d+\/concluir$/) && method === 'POST') {
        if (!pode(user, 'tarefas.write')) return err(env, 'Sem permissão.', 403);
        const tarefaId = Number(path.split('/')[3]);
        const t = await env.DB.prepare('SELECT propriedade_id FROM tarefas WHERE id = ?').bind(tarefaId).first();
        if (!t) return err(env, 'Tarefa não encontrada.', 404);
        if (!(await assertAcessoPropriedade(env, user, t.propriedade_id))) return err(env, 'Sem acesso a esta propriedade.', 403);
        await env.DB.prepare("UPDATE tarefas SET status = 'Concluida', concluida_em = datetime('now') WHERE id = ?").bind(tarefaId).run();
        return json({ ok: true }, 200, env);
      }
      if (path === '/api/tarefas/gerar-de-protocolos' && method === 'POST') {
        if (!pode(user, 'tarefas.write')) return err(env, 'Sem permissão.', 403);
        const negado = await exigirAcessoPid(); if (negado) return negado;
        const prot = await env.DB.prepare("SELECT * FROM sanidade_protocolos WHERE propriedade_id = ? AND gatilho = 'DiasAposEntrada'").bind(pid).all();
        const lotes = await env.DB.prepare("SELECT * FROM lotes_confinamento WHERE propriedade_id = ? AND status = 'Ativo'").bind(pid).all();
        let criadas = 0;
        for (const l of lotes.results || []) for (const p of prot.results || []) {
          const data = new Date(new Date(l.data_entrada).getTime() + (p.dias_offset || 0) * 86400000).toISOString().slice(0, 10);
          const r = await env.DB.prepare(
            "INSERT INTO tarefas (propriedade_id, titulo, tipo, data, lote_conf_id, prioridade, origem) SELECT ?,?,?,?,?,'Alta','Protocolo' WHERE NOT EXISTS (SELECT 1 FROM tarefas WHERE lote_conf_id = ? AND titulo = ? AND data = ?)"
          ).bind(pid, `${p.nome} — ${l.nome}`, 'Sanidade', data, l.id, l.id, `${p.nome} — ${l.nome}`, data).run();
          if (r.meta.changes > 0) criadas++;
        }
        return json({ criadas }, 201, env);
      }

      // ===== CRUD genérico com escopo por propriedade =====
      const CRUD = {
        currais:               { escopo: 'tratos.write' },
        lotes_confinamento:    { escopo: 'tratos.write' },
        animais:               { escopo: 'tratos.write' },
        pesagens:              { escopo: 'pesagens.write' },
        tratos:                { escopo: 'tratos.write' },
        sanidade_protocolos:   { escopo: 'sanidade.write' },
        sanidade_aplicacoes:   { escopo: 'sanidade.write' },
        sanidade_obitos:       { escopo: 'sanidade.write' },
        tarefas:               { escopo: 'tarefas.write' },
        alertas:               { escopo: null }, // somente leitura/gerado por regras
        alimentos:             { escopo: 'tratos.write', global: true },
        usuarios:              { escopo: '*', global: true },
        propriedades:          { escopo: '*', global: true },
      };
      const m = path.match(/^\/api\/([a-z_]+)(?:\/(\d+))?$/);
      if (m && CRUD[m[1]]) {
        const tabela = m[1]; const id = m[2] ? Number(m[2]) : null; const cfg = CRUD[tabela];
        const permitidas = COLUNAS[tabela];

        // alertas: gerados por regras automáticas — somente leitura
        if (tabela === 'alertas' && method !== 'GET') return err(env, 'Alertas são gerados por regras automáticas — somente leitura.', 403);

        if (method === 'GET' && !id) {
          if (tabela === 'usuarios') {
            if (!pode(user, '*')) return err(env, 'Apenas Admin.', 403);
            // NUNCA expor senha_hash
            const rows = await env.DB.prepare('SELECT id, nome, email, role, status FROM usuarios ORDER BY id').all();
            return json(rows.results || [], 200, env);
          }
          if (cfg.global) {
            const rows = await env.DB.prepare(`SELECT * FROM ${tabela}`).all();
            return json(rows.results || [], 200, env);
          }
          const negado = await exigirAcessoPid(); if (negado) return negado;
          const rows = await env.DB.prepare(`SELECT * FROM ${tabela} WHERE propriedade_id = ? ORDER BY id DESC`).bind(pid).all();
          return json(rows.results || [], 200, env);
        }
        if (method === 'POST') {
          if (cfg.escopo && !pode(user, cfg.escopo)) return err(env, 'Sem permissão.', 403);
          if (tabela === 'usuarios') {
            body.senha_hash = await hashSenha(body.senha || 'trocar123');
            delete body.senha;
            if (body.email) body.email = String(body.email).toLowerCase();
          }
          if (!cfg.global) {
            const negado = await exigirAcessoPid(); if (negado) return negado;
            body.propriedade_id = pid; // força o tenant — ignora o que o cliente mandou
          }
          const cols = Object.keys(body).filter((k) => k !== 'id');
          const invalidas = cols.filter((k) => !permitidas.includes(k));
          if (invalidas.length) return err(env, `Coluna(s) não permitida(s) em ${tabela}: ${invalidas.join(', ')}`, 400);
          if (!cols.length) return err(env, 'Nenhum campo para inserir.', 400);
          const ins = await env.DB.prepare(`INSERT INTO ${tabela} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).bind(...cols.map((c) => body[c])).run();
          return json({ id: ins.meta.last_row_id }, 201, env);
        }
        if (method === 'PUT' && id) {
          if (cfg.escopo && !pode(user, cfg.escopo)) return err(env, 'Sem permissão.', 403);
          if (tabela === 'usuarios' && body.senha) { body.senha_hash = await hashSenha(body.senha); delete body.senha; }
          if (!cfg.global) {
            const reg = await env.DB.prepare(`SELECT propriedade_id FROM ${tabela} WHERE id = ?`).bind(id).first();
            if (!reg) return err(env, 'Registro não encontrado.', 404);
            if (!(await assertAcessoPropriedade(env, user, reg.propriedade_id))) return err(env, 'Sem acesso a esta propriedade.', 403);
            delete body.propriedade_id; // não permite mover o registro de tenant
          }
          const cols = Object.keys(body).filter((k) => k !== 'id');
          const invalidas = cols.filter((k) => !permitidas.includes(k));
          if (invalidas.length) return err(env, `Coluna(s) não permitida(s) em ${tabela}: ${invalidas.join(', ')}`, 400);
          if (!cols.length) return err(env, 'Nenhum campo para atualizar.', 400);
          await env.DB.prepare(`UPDATE ${tabela} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).bind(...cols.map((c) => body[c]), id).run();
          return json({ ok: true }, 200, env);
        }
        if (method === 'DELETE' && id) {
          if (!pode(user, '*')) return err(env, 'Apenas Admin exclui registros.', 403);
          if (tabela === 'propriedades') return err(env, 'Use o fluxo de exclusão segura (2 etapas).', 409);
          if (!cfg.global) {
            const reg = await env.DB.prepare(`SELECT propriedade_id FROM ${tabela} WHERE id = ?`).bind(id).first();
            if (reg && !(await assertAcessoPropriedade(env, user, reg.propriedade_id))) return err(env, 'Sem acesso a esta propriedade.', 403);
          }
          await env.DB.prepare(`DELETE FROM ${tabela} WHERE id = ?`).bind(id).run();
          return json({ ok: true }, 200, env);
        }
      }

      return err(env, 'Rota não encontrada.', 404);
    } catch (e) {
      console.error('Erro não tratado no Worker:', e);
      return err(env, 'Erro interno.', 500);
    }
  },
};
