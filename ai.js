// src/lib/ai.js — Assistente IA 100% DeepSeek (API oficial)
// A chave é configurada pelo usuário na aba Configurações e fica no navegador
// (localStorage) — decisão de arquitetura aceita: o segredo não vai para o repo,
// mas fica acessível a scripts do próprio navegador.
// Modelo padrão: deepseek-v4-pro (fallback: deepseek-v4-flash), editável em
// Configurações. Os legados deepseek-chat / deepseek-reasoner foram
// DESCONTINUADOS em 24/07/2026 e não devem ser usados como padrão/fallback.
// Cadeia de degradação: chamada direta (chave local) → Worker (se apiOnline() e
// token de sessão presentes) → mensagem de erro legível. Nunca retorna null
// onde a UI espera string.

import { api, apiOnline, apiAutenticado } from './api';

const BASE_URL = 'https://api.deepseek.com';
export const DEEPSEEK_MODEL_DEFAULT = 'deepseek-v4-pro';
export const DEEPSEEK_MODEL_FALLBACK = 'deepseek-v4-flash'; // fallback oficial se o modelo configurado não existir

export const getDeepSeekKey = () => localStorage.getItem('bovigest_deepseek_key') || '';
export const setDeepSeekKey = (k) => k ? localStorage.setItem('bovigest_deepseek_key', k) : localStorage.removeItem('bovigest_deepseek_key');
export const getDeepSeekModel = () => localStorage.getItem('bovigest_deepseek_model') || DEEPSEEK_MODEL_DEFAULT;
export const setDeepSeekModel = (m) => m ? localStorage.setItem('bovigest_deepseek_model', m) : localStorage.removeItem('bovigest_deepseek_model');
export const deepSeekConfigurado = () => Boolean(getDeepSeekKey());

const SYSTEM_PROMPT =
  'Você é um consultor técnico sênior de confinamento bovino no Brasil (zootecnia, nutrição de precisão, sanidade e gestão). ' +
  'Responda em PT-BR, de forma objetiva, com números quando possível e recomendações operacionais práticas.';

const MSG_SEM_CHAVE =
  '⚠️ Chave da API DeepSeek não configurada. Vá em **Configurações → Assistente IA (DeepSeek)**, cole sua chave (https://platform.deepseek.com) e salve.';

/** Chamada direta à API oficial da DeepSeek (OpenAI-compatible). */
async function deepseekDirect(messages, { model, temperature = 0.3, max_tokens = 2000 } = {}) {
  const key = getDeepSeekKey().trim();
  if (!key) return null;
  const call = (mdl) => fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: mdl, messages, temperature, max_tokens, stream: false }),
  });
  let res = await call(model || getDeepSeekModel());
  if (res.status === 400 || res.status === 404) {
    // Modelo configurado indisponível na conta → cai para o modelo oficial estável
    res = await call(DEEPSEEK_MODEL_FALLBACK);
  }
  if (res.status === 401) throw new Error('Chave DeepSeek inválida ou expirada. Revise em Configurações.');
  if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || 'Sem resposta.';
}

const montarMensagens = (mensagem, contexto, historico = []) => [
  { role: 'system', content: SYSTEM_PROMPT },
  ...(contexto ? [{ role: 'system', content: `Contexto operacional da fazenda:\n${contexto}` }] : []),
  ...historico.map((m) => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text })),
  { role: 'user', content: mensagem },
];

/** Chat livre com o consultor. Degrada: direto → Worker → mensagem de erro. */
export async function aiChat(mensagem, contexto, historico = [], { model } = {}) {
  let erroDireto = null;
  if (deepSeekConfigurado()) {
    try {
      const r = await deepseekDirect(montarMensagens(mensagem, contexto, historico), { model });
      if (r) return r;
    } catch (e) { erroDireto = e; }
  }
  if (apiOnline() && apiAutenticado()) {
    try { return (await api.aiChat(mensagem, contexto, historico, model)).resposta; }
    catch (e) { return `❌ ${e.message}`; }
  }
  return erroDireto ? `❌ ${erroDireto.message}` : MSG_SEM_CHAVE;
}

/** Análise executiva dos indicadores (profunda=true → mais tokens p/ raciocínio). */
export async function aiAnalise(indicadores, profunda = false) {
  const prompt = `Gere um resumo executivo com pontos positivos, riscos e 3 ações recomendadas a partir destes indicadores do confinamento:\n${JSON.stringify(indicadores)}`;
  let erroDireto = null;
  if (deepSeekConfigurado()) {
    try {
      const r = await deepseekDirect(montarMensagens(prompt, ''), { max_tokens: profunda ? 3000 : 1500 });
      if (r) return r;
    } catch (e) { erroDireto = e; }
  }
  if (apiOnline() && apiAutenticado()) {
    try { return (await api.aiAnalise(indicadores, profunda)).resposta; }
    catch (e) { return `❌ ${e.message}`; }
  }
  return erroDireto ? `❌ ${erroDireto.message}` : MSG_SEM_CHAVE;
}

/** Parecer da IA sobre a série de leituras de cocho de um lote. Degrada: direto → Worker → null (a UI tem regra local de fallback). */
export async function aiAnalisarCocho(loteConfId, serieLocal = []) {
  if (deepSeekConfigurado() && serieLocal.length) {
    const prompt = `Série de leituras de cocho (escala 0=rapado … 4=sobra excessiva), mais antiga → mais recente:\n${JSON.stringify(serieLocal)}\nAponte a tendência de consumo e dê a recomendação final de ajuste de fornecimento (em %) com justificativa curta.`;
    try {
      const r = await deepseekDirect(montarMensagens(prompt, ''));
      if (r) return { parecer_ia: r };
    } catch { /* cai para o Worker */ }
  }
  if (apiOnline() && apiAutenticado()) {
    try { return await api.analisarCocho(loteConfId); } catch { return null; }
  }
  return null;
}

/** Monta o contexto operacional resumido enviado ao modelo. Aceita registros de água em camelCase (front) ou snake_case (Worker). */
export function montarContexto({ animais = [], lotesConf = [], tratos = [], leiturasCocho = [], agua = [], pesoMedio = 0, gmdMedio = null, saldoAtual = 0 }) {
  const confinados = lotesConf.filter(l => l.status !== 'Encerrado').reduce((a, l) => a + (Number(l.qtdEntrada) || 0), 0);
  const ultLeituras = [...leiturasCocho].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 5)
    .map(l => `${l.data}: nota ${l.nota} (${l.loteNome || 'lote'})`).join('; ') || 'sem leituras';
  const aguaAlertas = agua.filter(a => {
    const pressaoOk = a.pressaoOk ?? a.pressao_ok;
    return pressaoOk === false || (a.ph != null && (a.ph < 6.5 || a.ph > 8.5));
  }).length;
  return [
    `Rebanho: ${animais.length} cabeças; peso médio ${Math.round(pesoMedio)} kg.`,
    `Confinamento: ${confinados} cabeças em ${lotesConf.filter(l => l.status !== 'Encerrado').length} lotes ativos; GMD médio ${gmdMedio ? gmdMedio.toFixed(2) : '-'} kg/d.`,
    `Tratos lançados: ${tratos.length}. Últimas leituras de cocho: ${ultLeituras}.`,
    `Água: ${agua.length} registros, ${aguaAlertas} com inconformidade crítica.`,
    `Saldo financeiro: R$ ${saldoAtual.toFixed(2)}.`,
  ].join('\n');
}

export { SYSTEM_PROMPT };
