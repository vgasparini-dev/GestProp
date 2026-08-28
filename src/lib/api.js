// src/lib/api.js — Cliente da API GestProp (Cloudflare Worker)
// Se VITE_API_URL não estiver definida, o app opera em modo local (fallback).

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export const apiOnline = () => Boolean(API_URL);

const getToken = () => localStorage.getItem('bovigest_api_token') || '';
export const setToken = (t) => t ? localStorage.setItem('bovigest_api_token', t) : localStorage.removeItem('bovigest_api_token');
/** Sessão autenticada no Worker (token presente). Use junto com apiOnline() para decidir fallback local. */
export const apiAutenticado = () => Boolean(getToken());

async function req(path, { method = 'GET', body, form } = {}) {
  if (!API_URL) throw new Error('API não configurada (VITE_API_URL).');
  const headers = {};
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`;
  if (body && !form) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_URL}${path}`, {
    method, headers,
    body: form ? form : body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // Auth
  login: (email, senha) => req('/api/auth/login', { method: 'POST', body: { email, senha } }),
  health: () => req('/api/health'),

  // CRUD genérico (espelha as rotas do Worker)
  list: (colecao, propriedadeId) => req(`/api/${colecao}?propriedade_id=${propriedadeId}`),
  create: (colecao, dados) => req(`/api/${colecao}`, { method: 'POST', body: dados }),
  update: (colecao, id, dados) => req(`/api/${colecao}/${id}`, { method: 'PUT', body: dados }),
  remove: (colecao, id) => req(`/api/${colecao}/${id}`, { method: 'DELETE' }),

  // Cocho (R2 + IA)
  uploadCocho: (formData, propriedadeId) => {
    const q = propriedadeId != null ? `?propriedade_id=${encodeURIComponent(propriedadeId)}` : '';
    return req(`/api/cocho/upload${q}`, { method: 'POST', form: formData });
  },
  leiturasCocho: (propriedadeId) => req(`/api/cocho/leituras?propriedade_id=${propriedadeId}`),
  analisarCocho: (loteConfId) => req('/api/cocho/analisar', { method: 'POST', body: { lote_conf_id: loteConfId } }),
  // A rota de foto aceita ?token= para <img> (que não envia header Authorization)
  fotoCochoUrl: (key) => {
    const t = getToken();
    const q = t ? `?token=${encodeURIComponent(t)}` : '';
    return `${API_URL}/api/cocho/foto/${encodeURIComponent(key)}${q}`;
  },

  // Água
  aguaRegistrar: (dados) => req('/api/agua/registros', { method: 'POST', body: dados }),
  aguaListar: (propriedadeId) => req(`/api/agua/registros?propriedade_id=${propriedadeId}`),

  // Desempenho & sanidade
  desempenhoLote: (loteConfId) => req(`/api/pesagens/desempenho?lote_conf_id=${loteConfId}`),
  indicadoresSanidade: (propriedadeId) => req(`/api/sanidade/indicadores?propriedade_id=${propriedadeId}`),
  carenciasVigentes: (propriedadeId) => req(`/api/sanidade/carencia?propriedade_id=${propriedadeId}`),

  // Tarefas / calendário
  tarefas: (propriedadeId, de, ate) => req(`/api/tarefas?propriedade_id=${propriedadeId}&de=${de}&ate=${ate}`),
  concluirTarefa: (id) => req(`/api/tarefas/${id}/concluir`, { method: 'POST' }),
  gerarTarefasProtocolos: (propriedadeId) => req('/api/tarefas/gerar-de-protocolos', { method: 'POST', body: { propriedade_id: propriedadeId } }),

  // Exclusão segura de propriedade (2 etapas)
  excluirPropriedadeEtapa1: (id, nome, modo) => req(`/api/propriedades/${id}/excluir`, { method: 'POST', body: { nome_confirmacao: nome, modo } }),
  excluirPropriedadeEtapa2: (id, token, modo) => req(`/api/propriedades/${id}`, { method: 'DELETE', body: { token, modo } }),

  // IA — DeepSeek via Worker (a chave NUNCA fica no front)
  aiChat: (mensagem, contexto, historico, model) => req('/api/ai/chat', { method: 'POST', body: { mensagem, contexto, historico, model } }),
  aiAnalise: (indicadores, profunda = false) => req('/api/ai/analise', { method: 'POST', body: { indicadores, profunda } }),
};
