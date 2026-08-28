// src/views/Agua.jsx — Monitoramento de Água (potabilidade + disponibilidade)
import React, { useMemo, useState } from 'react';
import { Droplets, Plus, AlertTriangle, CheckCircle2, Thermometer, FlaskConical, Gauge, Brush } from 'lucide-react';
import { Modal, Input, Select, Table, EmptyState, dataBR } from '../components/ui';

const regrasAlerta = (r) => {
  const out = [];
  if (r.pressaoOk === false || r.pressaoOk === 'false') out.push({ nivel: 'Emergencia', msg: 'Queda de pressão no bebedouro — verificar bomba/registro imediatamente.' });
  if (r.ph != null && r.ph !== '' && (Number(r.ph) < 6.5 || Number(r.ph) > 8.5)) out.push({ nivel: 'Emergencia', msg: `pH fora da faixa de potabilidade (${r.ph}). Faixa aceitável: 6,5–8,5.` });
  if (r.turbidez === 'Alta') out.push({ nivel: 'Atencao', msg: 'Turbidez alta — risco de redução de consumo hídrico e GMD.' });
  if (r.temperaturaC != null && r.temperaturaC !== '' && Number(r.temperaturaC) > 30) out.push({ nivel: 'Atencao', msg: `Água a ${r.temperaturaC}°C — acima de 30 °C reduz o consumo.` });
  if (r.vazaoLh != null && r.vazaoLh !== '' && Number(r.vazaoLh) < 300) out.push({ nivel: 'Atencao', msg: `Vazão baixa (${r.vazaoLh} L/h) — insuficiente para lotes grandes.` });
  return out;
};

export default function Agua({ currais, lotesConfAtivos, registros, onAdd, onAlertas }) {
  const [modal, setModal] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const status = (r) => regrasAlerta(r).length === 0 ? 'ok' : regrasAlerta(r).some(a => a.nivel === 'Emergencia') ? 'emergencia' : 'atencao';
  const conformes = registros.filter(r => status(r) === 'ok').length;
  const criticos = registros.filter(r => status(r) === 'emergencia');
  const semLimpeza = useMemo(() => {
    const porCurral = {};
    [...registros].sort((a, b) => new Date(b.data) - new Date(a.data)).forEach(r => {
      const k = r.curralNome || r.curralId || 'geral';
      if (!porCurral[k]) porCurral[k] = r;
    });
    return Object.values(porCurral).filter(r => !r.limpezaFeita || (today !== r.data));
  }, [registros, today]);

  const salvar = (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target).entries());
    const reg = {
      id: Date.now(), data: f.data, curralNome: f.curralNome, loteConfId: f.loteConfId ? Number(f.loteConfId) : null,
      limpezaFeita: f.limpezaFeita === '1', vazaoLh: f.vazaoLh ? Number(f.vazaoLh) : null,
      pressaoOk: f.pressaoOk === '1', turbidez: f.turbidez, ph: f.ph ? Number(f.ph) : null,
      temperaturaC: f.temperaturaC ? Number(f.temperaturaC) : null, obs: f.obs || '',
    };
    onAdd(reg);
    const novosAlertas = regrasAlerta(reg).map(a => ({ ...a, categoria: 'Agua', ref: reg.curralNome, data: reg.data }));
    if (novosAlertas.length && onAlertas) onAlertas(novosAlertas);
    setModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-center">
        <h3 className="text-2xl font-black flex items-center"><Droplets className="mr-3 text-cyan-500" /> Monitoramento de Água</h3>
        <button onClick={() => setModal(true)} className="bg-cyan-600 text-white font-bold px-6 py-3 rounded-2xl flex items-center"><Plus size={18} className="mr-2" /> Registrar Verificação</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl border shadow-sm"><div className="bg-cyan-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-3 text-cyan-600"><CheckCircle2 size={24} /></div><h3 className="text-3xl font-black">{conformes}</h3><p className="text-xs font-bold text-gray-400 mt-1 uppercase">Registros conformes</p></div>
        <div className="bg-white p-6 rounded-3xl border shadow-sm"><div className="bg-red-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-3 text-red-600"><AlertTriangle size={24} /></div><h3 className="text-3xl font-black">{criticos.length}</h3><p className="text-xs font-bold text-gray-400 mt-1 uppercase">Emergências</p></div>
        <div className="bg-white p-6 rounded-3xl border shadow-sm"><div className="bg-amber-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-3 text-amber-600"><Brush size={24} /></div><h3 className="text-3xl font-black">{semLimpeza.length}</h3><p className="text-xs font-bold text-gray-400 mt-1 uppercase">Bebedouros p/ limpar</p></div>
        <div className="bg-white p-6 rounded-3xl border shadow-sm"><div className="bg-blue-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-3 text-blue-600"><Gauge size={24} /></div><h3 className="text-3xl font-black">{registros.length}</h3><p className="text-xs font-bold text-gray-400 mt-1 uppercase">Verificações</p></div>
      </div>

      {criticos.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-3xl p-5">
          <h4 className="font-black text-red-800 flex items-center mb-3"><AlertTriangle size={18} className="mr-2" /> Emergências de água ativas</h4>
          <div className="space-y-2">
            {criticos.slice(0, 5).map(r => regrasAlerta(r).filter(a => a.nivel === 'Emergencia').map((a, i) => (
              <p key={`${r.id}-${i}`} className="text-sm font-bold text-red-700">{dataBR(r.data)} • {r.curralNome || 'Geral'} — {a.msg}</p>
            )))}
          </div>
        </div>
      )}

      {registros.length === 0 ? (
        <EmptyState icon={Droplets} titulo="Nenhuma verificação registrada" subtitulo="Registre limpeza, vazão, turbidez, pH e temperatura dos bebedouros por curral/lote." />
      ) : (
        <Table headers={['Data / Local', 'Limpeza', 'Vazão', 'pH', 'Temp.', 'Turbidez', 'Status']}>
          {[...registros].sort((a, b) => new Date(b.data) - new Date(a.data)).map(r => {
            const st = status(r);
            return (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-5 py-4"><span className="font-black block text-sm">{dataBR(r.data)}</span><span className="text-xs font-bold text-gray-500">{r.curralNome || 'Geral'}</span></td>
                <td className="px-5 py-4">{r.limpezaFeita ? <span className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-xs font-bold">Feita</span> : <span className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-xs font-bold">Pendente</span>}</td>
                <td className="px-5 py-4 font-bold">{r.vazaoLh != null ? `${r.vazaoLh} L/h` : '-'}{r.pressaoOk === false && <span className="block text-[10px] font-black text-red-600 uppercase">sem pressão</span>}</td>
                <td className="px-5 py-4 font-bold">{r.ph ?? '-'}</td>
                <td className="px-5 py-4 font-bold">{r.temperaturaC != null ? `${r.temperaturaC}°C` : '-'}</td>
                <td className="px-5 py-4 font-bold text-sm">{r.turbidez}</td>
                <td className="px-5 py-4 text-right"><span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${st === 'ok' ? 'bg-green-100 text-green-700' : st === 'emergencia' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{st === 'ok' ? 'Conforme' : st === 'emergencia' ? 'Emergência' : 'Atenção'}</span></td>
              </tr>
            );
          })}
        </Table>
      )}

      {modal && (
        <Modal title="Verificação de Bebedouro" icon={Droplets} formId="f_agua" onClose={() => setModal(false)} onSubmit={salvar} wide submitText="Registrar">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Data" name="data" type="date" req def={today} />
            <Select label="Curral" name="curralNome" req options={[{ val: '', lbl: 'Selecione...' }, ...currais.map(c => c.nome)]} />
          </div>
          <Select label="Lote de confinamento (opcional)" name="loteConfId" options={[{ val: '', lbl: '—' }, ...lotesConfAtivos.map(l => ({ val: l.id, lbl: l.nome }))]} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Limpeza do bebedouro" name="limpezaFeita" def="1" options={[{ val: '1', lbl: 'Realizada' }, { val: '0', lbl: 'Pendente' }]} />
            <Select label="Pressão da linha" name="pressaoOk" def="1" options={[{ val: '1', lbl: 'Normal' }, { val: '0', lbl: 'QUEDA DE PRESSÃO' }]} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Vazão (L/h)" name="vazaoLh" type="number" step="1" placeholder="ex: 600" />
            <Input label="pH" name="ph" type="number" step="0.1" placeholder="6,5–8,5" />
            <Input label="Temperatura (°C)" name="temperaturaC" type="number" step="0.5" />
          </div>
          <Select label="Turbidez" name="turbidez" def="Baixa" options={['Baixa', 'Media', 'Alta']} />
          <Input label="Observações" name="obs" placeholder="Ex: algas, vazamento, bebedouro quebrado..." />
          <p className="text-xs font-medium text-gray-400 flex items-center gap-2"><FlaskConical size={14} /> Potabilidade: pH 6,5–8,5 • turbidez baixa • vazão ≥ 300 L/h por bebedouro.</p>
          <p className="text-xs font-medium text-gray-400 flex items-center gap-2"><Thermometer size={14} /> Água acima de 30 °C reduz consumo hídrico e desempenho.</p>
        </Modal>
      )}
    </div>
  );
}
