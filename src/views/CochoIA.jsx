// src/views/CochoIA.jsx — Avaliação de Cocho & Leitura com IA
// Captura em tempo real (câmera) + upload em lote + escala 0–4 + ajuste de trato.
import React, { useMemo, useRef, useState } from 'react';
import { Camera, UploadCloud, Trash2, Loader2, Sparkles, Image as ImageIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { EmptyState, dataBR } from '../components/ui';
import { api, apiOnline } from '../lib/api';
import { aiAnalisarCocho } from '../lib/ai';
import { ESCALA_COCHO, ajustePorCocho } from '../lib/zoo';

const fileToDataURL = (file) => new Promise((res, rej) => {
  const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file);
});

const AjusteBadge = ({ pct }) => {
  if (pct == null) return <span className="text-xs font-bold text-gray-400">—</span>;
  if (pct > 0) return <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-100 text-green-700"><TrendingUp size={13} /> +{pct}% trato</span>;
  if (pct < 0) return <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-100 text-red-700"><TrendingDown size={13} /> {pct}% trato</span>;
  return <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 text-gray-600"><Minus size={13} /> manter</span>;
};

export default function CochoIA({ lotesConfAtivos, leituras, onAddLeituras, propriedadeId }) {
  const fileRef = useRef(null);
  const [pendentes, setPendentes] = useState([]); // [{file, url, loteConfId, nota}]
  const [lotePadrao, setLotePadrao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [analisando, setAnalisando] = useState(null);
  const [parecerIA, setParecerIA] = useState(null);
  const [filtroLote, setFiltroLote] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  const historicoLote = (loteId) => leituras
    .filter(l => Number(l.loteConfId) === Number(loteId))
    .sort((a, b) => new Date(a.data) - new Date(b.data));

  const onFiles = async (files) => {
    const list = await Promise.all([...files].map(async (f) => ({
      file: f, url: await fileToDataURL(f), loteConfId: lotePadrao, nota: 2,
    })));
    setPendentes(p => [...p, ...list]);
  };

  const enviarLote = async () => {
    const validos = pendentes.filter(p => p.loteConfId);
    if (!validos.length) return alert('Selecione o lote de cada foto antes de enviar.');
    setEnviando(true);
    const novas = [];
    let semFotoPersistida = 0;
    for (const p of validos) {
      const hist = historicoLote(p.loteConfId);
      const ajuste = ajustePorCocho(p.nota, hist);
      const lote = lotesConfAtivos.find(l => Number(l.id) === Number(p.loteConfId));
      let fotoKey = null;
      if (apiOnline()) {
        try {
          const fd = new FormData();
          fd.append('foto', p.file);
          fd.append('propriedade_id', propriedadeId); // fallback: também no form
          fd.append('lote_conf_id', p.loteConfId);
          fd.append('data', today); fd.append('nota', p.nota); fd.append('nota_fonte', 'manual');
          const r = await api.uploadCocho(fd, propriedadeId); // propriedade_id também na query string
          fotoKey = r.foto_key;
        } catch (e) { console.error('Falha upload R2, salvando apenas metadados:', e); }
      }
      // Segurança de quota: NUNCA persistir dataURL base64 em appData (Firestore ≤1 MiB / localStorage ~5 MB).
      // Sem upload R2, guarda-se apenas os metadados da leitura e o usuário é avisado.
      if (!fotoKey) semFotoPersistida++;
      novas.push({
        id: Date.now() + Math.random(), propriedadeId, loteConfId: Number(p.loteConfId),
        loteNome: lote?.nome || '', data: today, nota: p.nota, notaFonte: 'manual',
        ajustePct: ajuste, fotoDataUrl: null, fotoKey, fotoNaoPersistida: !fotoKey,
      });
    }
    onAddLeituras(novas);
    if (semFotoPersistida > 0) {
      alert(`${semFotoPersistida} leitura(s) registrada(s) SEM a foto: no modo local a imagem não é persistida (limite de armazenamento). Configure a API (VITE_API_URL) e faça login para enviar as fotos ao R2.`);
    }
    setPendentes(pendentes.filter(p => !p.loteConfId));
    setEnviando(false);
  };

  const analisar = async (loteId) => {
    setAnalisando(loteId); setParecerIA(null);
    const hist = historicoLote(loteId);
    const ultima = hist[hist.length - 1];
    const ajuste = ultima ? ajustePorCocho(ultima.nota, hist.slice(0, -1)) : 0;
    let parecer = null;
    try {
      const serie = hist.map(h => ({ data: h.data, nota: h.nota, ajuste: h.ajustePct }));
      const r = await aiAnalisarCocho(loteId, serie);
      parecer = r?.parecer_ia;
    } catch { /* fallback local */ }
    if (!parecer) {
      const e = ESCALA_COCHO[Math.round(ultima?.nota ?? 2)];
      parecer = `Leitura mais recente: nota ${ultima?.nota ?? '-'} (${e.rotulo}). Regra de manejo sugere ajuste de ${ajuste > 0 ? '+' : ''}${ajuste}% no fornecimento. ${ultima && hist.length >= 3 && hist.slice(-3).every(h => h.nota <= 1) ? 'Três leituras seguidas de cocho limpo — os animais pedem mais dieta.' : ''}${ultima && hist.length >= 3 && hist.slice(-3).every(h => h.nota >= 3) ? 'Três leituras seguidas de sobra alta — risco de desperdício e acidose; reduza e verifique a dieta.' : ''}`;
    }
    const lote = lotesConfAtivos.find(l => Number(l.id) === Number(loteId));
    setParecerIA({ lote: lote?.nome, texto: parecer, ajuste });
    setAnalisando(null);
  };

  const leiturasFiltradas = useMemo(() => [...leituras]
    .filter(l => !filtroLote || Number(l.loteConfId) === Number(filtroLote))
    .sort((a, b) => new Date(b.data) - new Date(a.data)), [leituras, filtroLote]);

  return (
    <div className="space-y-6">
      {/* Captura e upload em lote */}
      <div className="bg-white rounded-3xl border shadow-sm p-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-center mb-4">
          <div>
            <h3 className="font-black text-lg flex items-center"><Camera size={20} className="mr-2 text-green-600" /> Nova Leitura de Cocho</h3>
            <p className="text-xs font-medium text-gray-400 mt-1">Fotografe os cochos antes do 1º trato. Escala 0 (rapado) a 4 (sobra excessiva).</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <select value={lotePadrao} onChange={e => setLotePadrao(e.target.value)} className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm">
              <option value="">Lote p/ todas as fotos...</option>
              {lotesConfAtivos.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
            <button onClick={() => fileRef.current?.click()} className="bg-green-600 text-white font-bold px-5 py-3 rounded-2xl flex items-center"><Camera size={18} className="mr-2" /> Fotografar / Upload</button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={e => onFiles(e.target.files)} />
          </div>
        </div>

        {pendentes.length > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {pendentes.map((p, i) => (
                <div key={i} className="bg-gray-50 rounded-2xl border overflow-hidden">
                  <img src={p.url} alt="cocho" className="w-full h-28 object-cover" />
                  <div className="p-3 space-y-2">
                    <select value={p.loteConfId} onChange={e => setPendentes(prev => prev.map((x, j) => j === i ? { ...x, loteConfId: e.target.value } : x))} className="w-full px-2 py-1.5 bg-white border rounded-lg text-xs font-bold">
                      <option value="">Lote/curral...</option>
                      {lotesConfAtivos.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
                    </select>
                    <div className="flex justify-between items-center">
                      <select value={p.nota} onChange={e => setPendentes(prev => prev.map((x, j) => j === i ? { ...x, nota: Number(e.target.value) } : x))} className="px-2 py-1.5 bg-white border rounded-lg text-xs font-black">
                        {ESCALA_COCHO.map(e2 => <option key={e2.nota} value={e2.nota}>{e2.nota} — {e2.rotulo}</option>)}
                      </select>
                      <button onClick={() => setPendentes(prev => prev.filter((_, j) => j !== i))} className="text-red-400 p-1"><Trash2 size={15} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={enviarLote} disabled={enviando} className="mt-4 w-full py-3.5 rounded-2xl font-bold text-white bg-slate-900 hover:bg-black flex items-center justify-center">
              {enviando ? <Loader2 size={18} className="mr-2 animate-spin" /> : <UploadCloud size={18} className="mr-2" />}
              Enviar {pendentes.filter(p => p.loteConfId).length} leituras {apiOnline() ? '(Cloudflare R2)' : '(modo local)'}
            </button>
          </>
        )}
      </div>

      {/* Guia da escala */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {ESCALA_COCHO.map(e => (
          <div key={e.nota} className={`rounded-2xl p-4 ${e.cor.split(' ')[1]} bg-opacity-60 border`}>
            <p className={`font-black text-lg ${e.cor.split(' ')[0]}`}>Nota {e.nota}</p>
            <p className="text-xs font-bold text-gray-700">{e.rotulo}</p>
            <p className="text-[10px] font-medium text-gray-500 mt-1">{e.desc}</p>
          </div>
        ))}
      </div>

      {/* Análise por IA */}
      {lotesConfAtivos.length > 0 && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-6 text-white">
          <div className="flex flex-col sm:flex-row justify-between gap-3 sm:items-center">
            <div>
              <h3 className="font-black text-lg flex items-center"><Sparkles size={20} className="mr-2 text-amber-400" /> Ajuste de Trato com IA (DeepSeek)</h3>
              <p className="text-xs font-medium text-slate-400 mt-1">Interpreta a série de leituras e recomenda o próximo fornecimento.</p>
            </div>
            <div className="flex gap-2">
              <select id="loteAnalise" defaultValue="" className="px-4 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold border border-slate-700">
                <option value="" disabled>Lote...</option>
                {lotesConfAtivos.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
              <button onClick={() => { const v = document.getElementById('loteAnalise').value; if (v) analisar(v); }} disabled={analisando != null} className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 font-bold px-5 py-2.5 rounded-xl flex items-center">
                {analisando ? <Loader2 size={16} className="animate-spin" /> : 'Analisar'}
              </button>
            </div>
          </div>
          {parecerIA && (
            <div className="mt-4 bg-white/10 rounded-2xl p-5">
              <p className="text-xs font-bold text-amber-300 uppercase mb-2">Parecer — {parecerIA.lote} • ajuste recomendado {parecerIA.ajuste > 0 ? '+' : ''}{parecerIA.ajuste}%</p>
              <p className="text-sm font-medium text-slate-100 whitespace-pre-wrap leading-relaxed">{parecerIA.texto}</p>
            </div>
          )}
        </div>
      )}

      {/* Histórico */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-black text-lg text-gray-700">Histórico de Leituras</h3>
          <select value={filtroLote} onChange={e => setFiltroLote(e.target.value)} className="px-4 py-2 bg-white border rounded-xl text-sm font-bold">
            <option value="">Todos os lotes</option>
            {lotesConfAtivos.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        </div>
        {leiturasFiltradas.length === 0 ? (
          <EmptyState icon={ImageIcon} titulo="Nenhuma leitura registrada" subtitulo="Fotografe o cocho antes do trato para gerar o histórico e o ajuste automático." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {leiturasFiltradas.map(l => {
              const e = ESCALA_COCHO[Math.round(l.nota ?? 2)];
              const src = l.fotoDataUrl || (l.fotoKey && apiOnline() ? api.fotoCochoUrl(l.fotoKey) : null);
              return (
                <div key={l.id} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                  {src ? <img src={src} alt="cocho" className="w-full h-36 object-cover" /> : <div className="w-full h-36 bg-gray-100 flex items-center justify-center text-gray-300"><ImageIcon size={32} /></div>}
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-black text-sm">{l.loteNome || `Lote #${l.loteConfId}`}</span>
                      <span className="text-xs font-bold text-gray-400">{dataBR(l.data)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${e.cor}`}>{l.nota} — {e.rotulo}</span>
                      <AjusteBadge pct={l.ajustePct} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
