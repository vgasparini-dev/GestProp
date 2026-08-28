// src/views/SanidadePro.jsx — Sanidade aprofundada do confinamento
// Protocolos (vacinação/vermifugação/metafilaxia) + hospital + carência + indicadores.
import React, { useMemo, useState } from 'react';
import { ShieldAlert, Plus, Stethoscope, Syringe, Skull, Lock, CalendarClock, Trash2, Edit, AlertTriangle } from 'lucide-react';
import { Modal, Input, Select, Table, EmptyState, formatCurrency, dataBR } from '../components/ui';
import { indicadoresSanidade } from '../lib/zoo';

const hojeISO = () => new Date().toISOString().slice(0, 10);

export default function SanidadePro({ protocolos, aplicacoes, obitos, lotesConfAtivos, lotes, animais, onSave, onDelete }) {
  const [tab, setTab] = useState('indicadores');
  const [modal, setModal] = useState(null); // protocolo | aplicacao | obito
  const [editing, setEditing] = useState(null);
  const today = hojeISO();

  // Carências vigentes (bloqueio de abate)
  const carencias = useMemo(() => aplicacoes.filter(a => a.dataLiberacao && a.dataLiberacao > today), [aplicacoes, today]);
  const loteBloqueado = (loteId) => carencias.find(c => Number(c.loteConfId) === Number(loteId));

  const indic = useMemo(() => indicadoresSanidade({
    lotes: lotesConfAtivos,
    tratamentos: aplicacoes.filter(a => a.tipo === 'Tratamento'),
    obitos,
  }), [lotesConfAtivos, aplicacoes, obitos]);

  const salvar = (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target).entries());
    const base = { id: editing?.id || Date.now() };
    if (modal === 'protocolo') {
      onSave('sanidadeProtocolos', { ...base, nome: f.nome, tipo: f.tipo, gatilho: f.gatilho, diasOffset: Number(f.diasOffset || 0), mesCampanha: f.mesCampanha || '', obrigatorio: f.obrigatorio === '1', itens: f.itens || '' });
    }
    if (modal === 'aplicacao') {
      const carencia = Number(f.carenciaDias || 0);
      const dt = new Date(f.dataAplicacao); dt.setDate(dt.getDate() + carencia);
      onSave('sanidadeAplicacoes', {
        ...base, tipo: f.tipo, farmaco: f.farmaco, dose: f.dose || '', loteConfId: f.loteConfId ? Number(f.loteConfId) : null,
        brinco: f.brinco || '', qtdAnimais: Number(f.qtdAnimais || 1), dataAplicacao: f.dataAplicacao,
        carenciaDias: carencia, dataLiberacao: carencia > 0 ? dt.toISOString().slice(0, 10) : null,
        custoTotal: Number(f.custoTotal || 0), diagnostico: f.diagnostico || '', protocoloNome: f.protocoloNome || '',
      });
    }
    if (modal === 'obito') {
      onSave('obitos', { ...base, loteConfId: f.loteConfId ? Number(f.loteConfId) : null, brinco: f.brinco || '', data: f.data, causaMortis: f.causaMortis, custoEstimado: Number(f.custoEstimado || 0) });
    }
    setModal(null); setEditing(null);
  };

  const abrir = (tipo, item = null) => { setEditing(item); setModal(tipo); };

  const TABS = [
    ['indicadores', 'Indicadores', Stethoscope],
    ['protocolos', 'Protocolos', Syringe],
    ['aplicacoes', 'Aplicações / Hospital', ShieldAlert],
    ['obitos', 'Óbitos', Skull],
  ];

  return (
    <div className="space-y-6">
      {/* Bloqueios de carência */}
      {carencias.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-3xl p-5">
          <h4 className="font-black text-red-800 flex items-center mb-3"><Lock size={18} className="mr-2" /> Bloqueio de abate — carência vigente ({carencias.length})</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {carencias.map(c => (
              <div key={c.id} className="bg-white border border-red-100 rounded-2xl p-3 flex items-center gap-3">
                <ShieldAlert size={18} className="text-red-500 shrink-0" />
                <div>
                  <p className="text-sm font-black text-red-800">{c.farmaco} — {c.brinco ? `Brinco ${c.brinco}` : lotesConfAtivos.find(l => Number(l.id) === Number(c.loteConfId))?.nome || c.loteNome || 'Rebanho'}</p>
                  <p className="text-xs font-bold text-red-500">Liberado para abate em {dataBR(c.dataLiberacao)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-center">
        <div className="bg-white border rounded-xl p-1 flex flex-wrap">
          {TABS.map(([id, lbl, Ic]) => (
            <button key={id} onClick={() => setTab(id)} className={`px-4 py-2 text-sm font-bold rounded-lg flex items-center gap-1.5 ${tab === id ? 'bg-red-50 text-red-700 shadow-sm' : 'text-gray-500'}`}><Ic size={15} /> {lbl}</button>
          ))}
        </div>
        <div className="flex gap-2">
          {tab === 'protocolos' && <button onClick={() => abrir('protocolo')} className="bg-red-600 text-white font-bold px-5 py-3 rounded-2xl flex items-center"><Plus size={18} className="mr-2" /> Protocolo</button>}
          {tab === 'aplicacoes' && <button onClick={() => abrir('aplicacao')} className="bg-red-600 text-white font-bold px-5 py-3 rounded-2xl flex items-center"><Plus size={18} className="mr-2" /> Aplicação / Tratamento</button>}
          {tab === 'obitos' && <button onClick={() => abrir('obito')} className="bg-slate-900 text-white font-bold px-5 py-3 rounded-2xl flex items-center"><Plus size={18} className="mr-2" /> Registrar Óbito</button>}
        </div>
      </div>

      {tab === 'indicadores' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-3xl border shadow-sm"><div className="bg-amber-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-3 text-amber-600"><Stethoscope size={24} /></div><h3 className="text-3xl font-black">{indic.morbidadePct.toFixed(1)}%</h3><p className="text-xs font-bold text-gray-400 mt-1 uppercase">Morbidade ({aplicacoes.filter(a => a.tipo === 'Tratamento').length} casos)</p></div>
            <div className="bg-white p-6 rounded-3xl border shadow-sm"><div className="bg-red-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-3 text-red-600"><Skull size={24} /></div><h3 className="text-3xl font-black">{indic.mortalidadePct.toFixed(1)}%</h3><p className="text-xs font-bold text-gray-400 mt-1 uppercase">Mortalidade ({obitos.length} óbitos)</p></div>
            <div className="bg-white p-6 rounded-3xl border shadow-sm"><div className="bg-purple-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-3 text-purple-600"><Syringe size={24} /></div><h3 className="text-2xl font-black mt-1">{formatCurrency(indic.custoMedicamentoCabeca)}</h3><p className="text-xs font-bold text-gray-400 mt-1 uppercase">Medicamento / cabeça</p></div>
            <div className="bg-white p-6 rounded-3xl border shadow-sm"><div className="bg-blue-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-3 text-blue-600"><CalendarClock size={24} /></div><h3 className="text-3xl font-black">{carencias.length}</h3><p className="text-xs font-bold text-gray-400 mt-1 uppercase">Em carência agora</p></div>
          </div>
          {Object.keys(indic.mortalidadePorCausa).length > 0 && (
            <div className="bg-white rounded-3xl border shadow-sm p-6">
              <h4 className="font-black text-lg mb-4">Mortalidade por causa mortis</h4>
              <div className="space-y-2">
                {Object.entries(indic.mortalidadePorCausa).sort((a, b) => b[1] - a[1]).map(([causa, n]) => (
                  <div key={causa} className="flex items-center gap-3">
                    <span className="text-sm font-bold w-40 truncate">{causa}</span>
                    <div className="flex-1 bg-gray-100 h-3 rounded-full"><div className="h-full bg-red-500 rounded-full" style={{ width: `${(n / obitos.length) * 100}%` }} /></div>
                    <span className="text-sm font-black w-10 text-right">{n}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {obitos.length === 0 && aplicacoes.filter(a => a.tipo === 'Tratamento').length === 0 && (
            <EmptyState icon={Stethoscope} titulo="Sem ocorrências clínicas" subtitulo="Tratamentos do hospital e óbitos alimentam os indicadores de morbidade e mortalidade." />
          )}
        </div>
      )}

      {tab === 'protocolos' && (
        protocolos.length === 0 ? <EmptyState icon={Syringe} titulo="Nenhum protocolo cadastrado" subtitulo="Crie protocolos de vacinação, vermifugação e metafilaxia de entrada. Tarefas são geradas no calendário automaticamente." /> : (
          <Table headers={['Protocolo', 'Tipo / Gatilho', 'Itens (fármacos)', 'Ações']}>
            {protocolos.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-5 py-4"><span className="font-black block text-sm">{p.nome}</span>{p.obrigatorio && <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded">Oficial</span>}</td>
                <td className="px-5 py-4 font-bold text-sm">{p.tipo} • {p.gatilho === 'DiasAposEntrada' ? `D+${p.diasOffset}` : p.gatilho === 'DataFixa' ? p.mesCampanha : p.gatilho}</td>
                <td className="px-5 py-4 text-xs font-medium text-gray-600 max-w-xs truncate">{p.itens}</td>
                <td className="px-5 py-4 text-right"><button onClick={() => abrir('protocolo', p)} className="text-blue-500 p-2"><Edit size={18} /></button><button onClick={() => onDelete('sanidadeProtocolos', p.id)} className="text-red-500 p-2"><Trash2 size={18} /></button></td>
              </tr>
            ))}
          </Table>
        )
      )}

      {tab === 'aplicacoes' && (
        aplicacoes.length === 0 ? <EmptyState icon={ShieldAlert} titulo="Nenhuma aplicação registrada" subtitulo="Lance vacinações, vermifugações, metafilaxia de entrada e tratamentos do hospital." /> : (
          <Table headers={['Data / Fármaco', 'Tipo', 'Alvo', 'Carência', 'Custo', 'Ações']}>
            {[...aplicacoes].sort((a, b) => new Date(b.dataAplicacao) - new Date(a.dataAplicacao)).map(a => {
              const emCarencia = a.dataLiberacao && a.dataLiberacao > today;
              return (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-5 py-4"><span className="font-black block text-sm">{a.farmaco}</span><span className="text-xs font-bold text-gray-500">{dataBR(a.dataAplicacao)}{a.dose ? ` • ${a.dose}` : ''}{a.diagnostico ? ` • ${a.diagnostico}` : ''}</span></td>
                  <td className="px-5 py-4"><span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${a.tipo === 'Tratamento' ? 'bg-purple-100 text-purple-700' : a.tipo === 'Metafilaxia' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{a.tipo}</span></td>
                  <td className="px-5 py-4 font-bold text-sm">{a.brinco ? `Brinco ${a.brinco}` : lotesConfAtivos.find(l => Number(l.id) === Number(a.loteConfId))?.nome || a.loteNome || 'Rebanho'} ({a.qtdAnimais} cab)</td>
                  <td className="px-5 py-4">{emCarencia ? <span className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1"><Lock size={12} className="inline mr-1" />até {dataBR(a.dataLiberacao)}</span> : <span className="text-xs font-bold text-gray-400">{a.carenciaDias > 0 ? 'Liberado' : 'Sem carência'}</span>}</td>
                  <td className="px-5 py-4 font-bold text-sm">{formatCurrency(a.custoTotal)}</td>
                  <td className="px-5 py-4 text-right"><button onClick={() => onDelete('sanidadeAplicacoes', a.id)} className="text-red-500 p-2"><Trash2 size={18} /></button></td>
                </tr>
              );
            })}
          </Table>
        )
      )}

      {tab === 'obitos' && (
        obitos.length === 0 ? <EmptyState icon={Skull} titulo="Nenhum óbito registrado" subtitulo="Registre óbitos com causa mortis para o indicador de mortalidade." /> : (
          <Table headers={['Data', 'Animal / Lote', 'Causa Mortis', 'Custo Est.', 'Ações']}>
            {[...obitos].sort((a, b) => new Date(b.data) - new Date(a.data)).map(o => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-5 py-4 font-bold text-sm">{dataBR(o.data)}</td>
                <td className="px-5 py-4 font-black text-sm">{o.brinco || '—'} <span className="text-xs font-bold text-gray-500">{lotesConfAtivos.find(l => Number(l.id) === Number(o.loteConfId))?.nome || ''}</span></td>
                <td className="px-5 py-4"><span className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-xs font-bold">{o.causaMortis}</span></td>
                <td className="px-5 py-4 font-bold text-sm">{formatCurrency(o.custoEstimado)}</td>
                <td className="px-5 py-4 text-right"><button onClick={() => onDelete('obitos', o.id)} className="text-red-500 p-2"><Trash2 size={18} /></button></td>
              </tr>
            ))}
          </Table>
        )
      )}

      {/* MODAIS */}
      {modal === 'protocolo' && (
        <Modal title={editing ? 'Editar Protocolo' : 'Novo Protocolo Sanitário'} icon={Syringe} formId="f_prot" onClose={() => { setModal(null); setEditing(null); }} onSubmit={salvar} wide>
          <Input label="Nome do Protocolo" name="nome" req def={editing?.nome} placeholder="Ex: Metafilaxia de Entrada" />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Tipo" name="tipo" def={editing?.tipo || 'Metafilaxia'} options={['Vacinacao', 'Vermifugacao', 'Metafilaxia', 'Outro']} />
            <Select label="Gatilho" name="gatilho" def={editing?.gatilho || 'DiasAposEntrada'} options={[{ val: 'DiasAposEntrada', lbl: 'Dias após entrada no confinamento' }, { val: 'Entrada', lbl: 'No dia da entrada' }, { val: 'DataFixa', lbl: 'Campanha anual (mês fixo)' }, { val: 'Recorrente', lbl: 'Recorrente' }]} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Dias após entrada (offset)" name="diasOffset" type="number" def={editing?.diasOffset ?? 0} />
            <Select label="Mês da campanha (se fixo)" name="mesCampanha" def={editing?.mesCampanha || ''} options={['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']} />
          </div>
          <Select label="Campanha oficial obrigatória?" name="obrigatorio" def={editing?.obrigatorio ? '1' : '0'} options={[{ val: '0', lbl: 'Não (manejo interno)' }, { val: '1', lbl: 'Sim (oficial)' }]} />
          <Input label="Fármacos e doses" name="itens" def={editing?.itens} placeholder="Ex: Ivermectina 1% — 1 mL/50 kg; Vitamina ADE — 5 mL" />
        </Modal>
      )}

      {modal === 'aplicacao' && (
        <Modal title="Aplicação / Tratamento Clínico" icon={ShieldAlert} formId="f_apl" onClose={() => { setModal(null); setEditing(null); }} onSubmit={salvar} wide submitText="Registrar">
          <div className="grid grid-cols-2 gap-4">
            <Select label="Tipo" name="tipo" def="Vacinacao" options={['Vacinacao', 'Vermifugacao', 'Metafilaxia', 'Tratamento']} />
            <Select label="Vincular a protocolo" name="protocoloNome" options={[{ val: '', lbl: '—' }, ...protocolos.map(p => p.nome)]} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Fármaco / Vacina" name="farmaco" req placeholder="Ex: Vacina Febre Aftosa" />
            <Input label="Dose" name="dose" placeholder="Ex: 2 mL" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Lote de confinamento" name="loteConfId" options={[{ val: '', lbl: '—' }, ...lotesConfAtivos.map(l => ({ val: l.id, lbl: l.nome }))]} />
            <Input label="Brinco (se individual / hospital)" name="brinco" placeholder="Opcional" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Data aplicação" name="dataAplicacao" type="date" req def={today} />
            <Input label="Qtd. animais" name="qtdAnimais" type="number" req def="1" />
            <Input label="Carência (dias)" name="carenciaDias" type="number" def="0" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Custo total (R$)" name="custoTotal" type="number" step="0.01" def="0" />
            <Input label="Diagnóstico (tratamento)" name="diagnostico" placeholder="Ex: BRD / pneumonia" />
          </div>
          {carencias.length > 0 && <p className="text-xs font-bold text-red-600 flex items-center gap-1"><AlertTriangle size={14} /> Animais sob carência ficam bloqueados para abate até a liberação.</p>}
        </Modal>
      )}

      {modal === 'obito' && (
        <Modal title="Registrar Óbito" icon={Skull} formId="f_obt" onClose={() => { setModal(null); setEditing(null); }} onSubmit={salvar}>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Data" name="data" type="date" req def={today} />
            <Input label="Brinco" name="brinco" placeholder="Opcional" />
          </div>
          <Select label="Lote de confinamento" name="loteConfId" options={[{ val: '', lbl: '—' }, ...lotesConfAtivos.map(l => ({ val: l.id, lbl: l.nome }))]} />
          <Input label="Causa mortis" name="causaMortis" req placeholder="Ex: Acidose, BRD, timpanismo, traumatismo..." />
          <Input label="Custo estimado (R$)" name="custoEstimado" type="number" step="0.01" def="0" />
        </Modal>
      )}
    </div>
  );
}
