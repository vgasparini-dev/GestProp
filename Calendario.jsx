// src/views/Calendario.jsx — Calendário Operacional (Mensal / Semanal / Kanban)
import React, { useMemo, useState } from 'react';
import { CalendarDays, Plus, ChevronLeft, ChevronRight, CheckCircle2, Filter, KanbanSquare, LayoutList, CalendarRange } from 'lucide-react';
import { Modal, Input, Select, EmptyState, dataBR } from '../components/ui';

const TIPOS = {
  Sanidade: { cor: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
  Pesagem: { cor: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  LimpezaBebedouro: { cor: 'bg-cyan-100 text-cyan-700 border-cyan-200', dot: 'bg-cyan-500' },
  TransicaoDieta: { cor: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  Manejo: { cor: 'bg-indigo-100 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
  Cocho: { cor: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' },
  Outro: { cor: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' },
};
const PRIO = { Critica: '🔴', Alta: '🟠', Media: '🟡', Baixa: '⚪' };
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const iso = (d) => d.toISOString().slice(0, 10);

export default function Calendario({ tarefas, onAdd, onToggle, lotesConfAtivos }) {
  const [modo, setModo] = useState('mensal'); // mensal | semanal | kanban
  const [cursor, setCursor] = useState(new Date());
  const [filtroLote, setFiltroLote] = useState('');
  const [filtroPrio, setFiltroPrio] = useState('');
  const [modal, setModal] = useState(false);
  const today = iso(new Date());

  const filtradas = useMemo(() => tarefas.filter(t =>
    (!filtroLote || Number(t.loteConfId) === Number(filtroLote)) &&
    (!filtroPrio || t.prioridade === filtroPrio)
  ), [tarefas, filtroLote, filtroPrio]);

  const porData = useMemo(() => filtradas.reduce((acc, t) => { (acc[t.data] = acc[t.data] || []).push(t); return acc; }, {}), [filtradas]);

  // ----- grade mensal -----
  const gradeMensal = useMemo(() => {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    const primeiro = new Date(y, m, 1);
    const offset = (primeiro.getDay() + 6) % 7; // semana começa na segunda
    const diasNoMes = new Date(y, m + 1, 0).getDate();
    const celulas = [];
    for (let i = 0; i < offset; i++) celulas.push(null);
    for (let d = 1; d <= diasNoMes; d++) celulas.push(iso(new Date(y, m, d)));
    return celulas;
  }, [cursor]);

  // ----- semana corrente do cursor -----
  const semana = useMemo(() => {
    const d = new Date(cursor);
    const diff = (d.getDay() + 6) % 7;
    const ini = new Date(d); ini.setDate(d.getDate() - diff);
    return Array.from({ length: 7 }, (_, i) => { const x = new Date(ini); x.setDate(ini.getDate() + i); return iso(x); });
  }, [cursor]);

  const mover = (dir) => {
    const d = new Date(cursor);
    if (modo === 'mensal') d.setMonth(d.getMonth() + dir); else d.setDate(d.getDate() + 7 * dir);
    setCursor(d);
  };

  const salvar = (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target).entries());
    onAdd({
      id: Date.now(), titulo: f.titulo, tipo: f.tipo, data: f.data,
      loteConfId: f.loteConfId ? Number(f.loteConfId) : null,
      prioridade: f.prioridade, status: 'Pendente', origem: 'Manual', obs: f.obs || '',
    });
    setModal(false);
  };

  const Card = ({ t, compact }) => (
    <div className={`border rounded-xl p-2.5 ${TIPOS[t.tipo]?.cor || TIPOS.Outro.cor} ${t.status === 'Concluida' ? 'opacity-50 line-through' : ''}`}>
      <div className="flex items-start justify-between gap-1">
        <p className="text-xs font-black leading-tight flex-1">{PRIO[t.prioridade] || ''} {t.titulo}</p>
        {!compact && (
          <button onClick={() => onToggle(t.id)} title="Concluir/Reabrir" className="shrink-0 opacity-60 hover:opacity-100">
            <CheckCircle2 size={14} />
          </button>
        )}
      </div>
      {!compact && t.obs && <p className="text-[10px] font-medium mt-1 opacity-80">{t.obs}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between gap-4 lg:items-center">
        <h3 className="text-2xl font-black flex items-center"><CalendarDays className="mr-3 text-indigo-500" /> Calendário Operacional</h3>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="bg-white border rounded-xl p-1 flex">
            {[[CalendarRange, 'mensal', 'Mensal'], [LayoutList, 'semanal', 'Semanal'], [KanbanSquare, 'kanban', 'Kanban']].map(([Ic, id, lbl]) => (
              <button key={id} onClick={() => setModo(id)} className={`px-4 py-2 text-sm font-bold rounded-lg flex items-center gap-1.5 ${modo === id ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-500'}`}><Ic size={15} /> {lbl}</button>
            ))}
          </div>
          <button onClick={() => setModal(true)} className="bg-indigo-600 text-white font-bold px-5 py-3 rounded-2xl flex items-center"><Plus size={18} className="mr-2" /> Tarefa</button>
        </div>
      </div>

      {/* Filtros + navegação */}
      <div className="flex flex-wrap gap-2 items-center bg-white border rounded-2xl p-3 shadow-sm">
        <Filter size={16} className="text-gray-400 ml-1" />
        <select value={filtroLote} onChange={e => setFiltroLote(e.target.value)} className="px-3 py-2 bg-gray-50 border rounded-xl text-sm font-bold">
          <option value="">Todos os lotes</option>
          {lotesConfAtivos.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
        </select>
        <select value={filtroPrio} onChange={e => setFiltroPrio(e.target.value)} className="px-3 py-2 bg-gray-50 border rounded-xl text-sm font-bold">
          <option value="">Todas as prioridades</option>
          {Object.keys(PRIO).map(p => <option key={p} value={p}>{PRIO[p]} {p}</option>)}
        </select>
        {modo !== 'kanban' && (
          <div className="flex items-center gap-1 ml-auto">
            <button onClick={() => mover(-1)} className="p-2 bg-gray-50 border rounded-xl hover:bg-gray-100"><ChevronLeft size={16} /></button>
            <button onClick={() => setCursor(new Date())} className="px-4 py-2 bg-gray-50 border rounded-xl text-sm font-bold hover:bg-gray-100">
              {modo === 'mensal' ? `${MESES[cursor.getMonth()]} ${cursor.getFullYear()}` : `Semana de ${dataBR(semana[0])}`}
            </button>
            <button onClick={() => mover(1)} className="p-2 bg-gray-50 border rounded-xl hover:bg-gray-100"><ChevronRight size={16} /></button>
          </div>
        )}
      </div>

      {/* MENSAL */}
      {modo === 'mensal' && (
        <div className="bg-white border rounded-3xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b bg-gray-50">
            {DIAS.map(d => <div key={d} className="px-2 py-3 text-center text-xs font-black uppercase text-gray-400">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {gradeMensal.map((dia, i) => (
              <div key={i} className={`min-h-[110px] border-b border-r p-1.5 ${dia === today ? 'bg-indigo-50/60' : ''} ${!dia ? 'bg-gray-50/50' : ''}`}>
                {dia && (
                  <>
                    <p className={`text-xs font-black mb-1 ${dia === today ? 'text-indigo-600' : 'text-gray-400'}`}>{Number(dia.slice(8))}</p>
                    <div className="space-y-1">
                      {(porData[dia] || []).slice(0, 3).map(t => <Card key={t.id} t={t} compact />)}
                      {(porData[dia] || []).length > 3 && <p className="text-[10px] font-bold text-gray-400">+{porData[dia].length - 3} mais</p>}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SEMANAL */}
      {modo === 'semanal' && (
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
          {semana.map((dia, i) => (
            <div key={dia} className={`bg-white border rounded-2xl p-3 min-h-[180px] ${dia === today ? 'ring-2 ring-indigo-400' : ''}`}>
              <p className="text-xs font-black uppercase text-gray-400">{DIAS[i]}</p>
              <p className={`text-lg font-black mb-2 ${dia === today ? 'text-indigo-600' : ''}`}>{dataBR(dia).slice(0, 5)}</p>
              <div className="space-y-1.5">
                {(porData[dia] || []).map(t => <Card key={t.id} t={t} />)}
                {!(porData[dia] || []).length && <p className="text-[10px] font-medium text-gray-300">Livre</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* KANBAN */}
      {modo === 'kanban' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[['Pendente', 'text-amber-600'], ['EmAndamento', 'text-blue-600'], ['Concluida', 'text-green-600']].map(([st, cor]) => (
            <div key={st} className="bg-gray-50 border rounded-2xl p-3">
              <p className={`text-xs font-black uppercase mb-3 ${cor}`}>{st === 'EmAndamento' ? 'Em Andamento' : st === 'Concluida' ? 'Concluídas' : 'Pendentes'} ({filtradas.filter(t => t.status === st).length})</p>
              <div className="space-y-2">
                {filtradas.filter(t => t.status === st).sort((a, b) => new Date(a.data) - new Date(b.data)).map(t => (
                  <div key={t.id} className="bg-white border rounded-xl p-3 shadow-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`w-2 h-2 rounded-full ${TIPOS[t.tipo]?.dot || 'bg-gray-400'}`} />
                      <span className="text-[10px] font-black uppercase text-gray-400">{t.tipo} • {dataBR(t.data)}</span>
                    </div>
                    <p className="text-sm font-black">{t.titulo}</p>
                    <p className="text-[10px] font-bold text-gray-400 mt-0.5">{PRIO[t.prioridade]} {t.prioridade}{t.origem === 'Protocolo' ? ' • gerada por protocolo' : ''}</p>
                    <div className="flex gap-1.5 mt-2">
                      {st !== 'EmAndamento' && st !== 'Concluida' && <button onClick={() => onToggle(t.id, 'EmAndamento')} className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded-lg">Iniciar</button>}
                      {st !== 'Concluida' && <button onClick={() => onToggle(t.id, 'Concluida')} className="text-[10px] font-bold bg-green-50 text-green-600 px-2 py-1 rounded-lg">Concluir</button>}
                      {st === 'Concluida' && <button onClick={() => onToggle(t.id, 'Pendente')} className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded-lg">Reabrir</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {filtradas.length === 0 && <EmptyState icon={CalendarDays} titulo="Nenhuma tarefa no período" subtitulo="Crie tarefas de manejo, pesagem, limpeza de bebedouro e transições de dieta." />}

      {modal && (
        <Modal title="Nova Tarefa Operacional" icon={CalendarDays} formId="f_tar" onClose={() => setModal(false)} onSubmit={salvar} wide submitText="Agendar">
          <Input label="Título" name="titulo" req placeholder="Ex: Pesagem lote 2026-A" />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Tipo" name="tipo" def="Manejo" options={Object.keys(TIPOS).map(k => ({ val: k, lbl: k === 'LimpezaBebedouro' ? 'Limpeza de Bebedouro' : k === 'TransicaoDieta' ? 'Transição de Dieta' : k }))} />
            <Input label="Data" name="data" type="date" req def={today} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Lote (opcional)" name="loteConfId" options={[{ val: '', lbl: '—' }, ...lotesConfAtivos.map(l => ({ val: l.id, lbl: l.nome }))]} />
            <Select label="Prioridade" name="prioridade" def="Media" options={Object.keys(PRIO)} />
          </div>
          <Input label="Observações" name="obs" placeholder="Detalhes do manejo..." />
        </Modal>
      )}
    </div>
  );
}
