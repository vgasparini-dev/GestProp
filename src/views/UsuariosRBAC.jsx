// src/views/UsuariosRBAC.jsx — Gestão de Usuários e Permissões (RBAC)
// Acesso restrito a Admin. Papéis: Admin, Zootecnista, Veterinario, Vaqueiro.
import React, { useState } from 'react';
import { Users, Plus, Edit, Trash2, ShieldCheck, Lock } from 'lucide-react';
import { Modal, Input, Select, Table } from '../components/ui';

export const PAPEIS = {
  Admin: {
    lbl: 'Administrador', cor: 'bg-purple-100 text-purple-700',
    permissoes: ['Acesso total', 'Gestão de usuários', 'Exclusão de propriedades', 'Financeiro', 'Configurações'],
  },
  Zootecnista: {
    lbl: 'Zootecnista / Nutricionista', cor: 'bg-green-100 text-green-700',
    permissoes: ['Leitura de cocho + ajuste de trato', 'Nutrição e dietas', 'Pesagens e desempenho', 'Calendário', 'Assistente IA'],
  },
  Veterinario: {
    lbl: 'Médico Veterinário', cor: 'bg-red-100 text-red-700',
    permissoes: ['Protocolos sanitários', 'Aplicações e hospital', 'Óbitos e carência', 'Pesagens', 'Assistente IA'],
  },
  Vaqueiro: {
    lbl: 'Vaqueiro / Operador de Cocho', cor: 'bg-blue-100 text-blue-700',
    permissoes: ['Registro de tratos', 'Leitura de cocho (foto)', 'Verificação de água', 'Tarefas do dia'],
  },
};

/** Verifica se o papel tem acesso a uma área do menu. */
export const papelPodeVer = (role, viewId) => {
  if (role === 'Admin') return true;
  const mapa = {
    dashboard: ['Zootecnista', 'Veterinario', 'Vaqueiro'],
    animais: ['Zootecnista', 'Veterinario'],
    confinamento: ['Zootecnista', 'Veterinario', 'Vaqueiro'],
    cocho: ['Zootecnista', 'Vaqueiro'],
    agua: ['Zootecnista', 'Veterinario', 'Vaqueiro'],
    calendario: ['Zootecnista', 'Veterinario', 'Vaqueiro'],
    pesagens: ['Zootecnista', 'Veterinario'],
    sanidade: ['Veterinario'],
    nutricao: ['Zootecnista'],
    tratos: ['Vaqueiro', 'Zootecnista'],
    'ai-assistant': ['Zootecnista', 'Veterinario'],
    anotacoes: ['Zootecnista', 'Veterinario', 'Vaqueiro'],
  };
  return (mapa[viewId] || []).includes(role);
};

export default function UsuariosRBAC({ usuarios, onSave, onDelete, currentUser }) {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);

  if (currentUser?.role !== 'Admin') {
    return (
      <div className="bg-white rounded-3xl border shadow-sm p-12 text-center">
        <Lock size={40} className="mx-auto text-gray-300 mb-3" />
        <p className="font-black text-gray-500">Acesso restrito</p>
        <p className="text-sm text-gray-400 font-medium mt-1">Somente usuários com papel Administrador podem gerenciar contas.</p>
      </div>
    );
  }

  const salvar = (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target).entries());
    onSave({ id: editing?.id || Date.now(), nome: f.nome, email: f.email, senha: f.senha, role: f.role, status: f.status });
    setModal(false); setEditing(null);
  };

  const contar = (role) => usuarios.filter(u => u.role === role).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-center">
        <div>
          <h3 className="text-xl font-black text-gray-900">Gestão de Usuários (RBAC)</h3>
          <p className="text-sm text-gray-500">Controle de acesso por papel: o que cada perfil pode ver e operar.</p>
        </div>
        <button onClick={() => { setEditing(null); setModal(true); }} className="bg-green-600 text-white font-bold px-6 py-3 rounded-2xl flex items-center"><Plus size={18} className="mr-2" /> Novo Usuário</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Object.entries(PAPEIS).map(([role, cfg]) => (
          <div key={role} className="bg-white rounded-3xl border p-5 shadow-sm">
            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${cfg.cor}`}>{cfg.lbl}</span>
            <p className="text-3xl font-black mt-3">{contar(role)}</p>
            <p className="text-xs font-bold text-gray-400 uppercase">usuários</p>
          </div>
        ))}
      </div>

      {/* Matriz de permissões */}
      <div className="bg-white rounded-3xl border shadow-sm p-6">
        <h4 className="font-black text-lg flex items-center mb-4"><ShieldCheck size={20} className="mr-2 text-green-600" /> Matriz de Permissões</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(PAPEIS).map(([role, cfg]) => (
            <div key={role} className="border rounded-2xl p-4">
              <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${cfg.cor}`}>{cfg.lbl}</span>
              <ul className="mt-3 space-y-1.5">
                {cfg.permissoes.map(p => <li key={p} className="text-xs font-medium text-gray-600 flex items-start gap-1.5"><ShieldCheck size={12} className="text-green-500 mt-0.5 shrink-0" /> {p}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <Table headers={['Nome', 'Email', 'Papel', 'Status', 'Ações']}>
        {usuarios.map((u) => (
          <tr key={u.id} className="hover:bg-gray-50">
            <td className="px-5 py-4 font-black text-sm text-gray-900">{u.nome}</td>
            <td className="px-5 py-4 text-sm font-medium text-gray-600">{u.email}</td>
            <td className="px-5 py-4"><span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${PAPEIS[u.role]?.cor || 'bg-gray-100 text-gray-600'}`}>{PAPEIS[u.role]?.lbl || u.role}</span></td>
            <td className="px-5 py-4"><span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${u.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{u.status}</span></td>
            <td className="px-5 py-4 text-right">
              <button onClick={() => { setEditing(u); setModal(true); }} className="text-blue-500 p-2 hover:bg-blue-50 rounded-lg"><Edit size={18} /></button>
              {u.email !== currentUser.email && <button onClick={() => onDelete(u.id)} className="text-red-500 p-2 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>}
            </td>
          </tr>
        ))}
      </Table>

      {modal && (
        <Modal title={editing ? 'Editar Usuário' : 'Novo Usuário'} icon={Users} formId="f_rbac" onClose={() => { setModal(false); setEditing(null); }} onSubmit={salvar}>
          <Input label="Nome Completo" name="nome" req def={editing?.nome} />
          <Input label="Email de Login" name="email" type="email" req def={editing?.email} />
          <Input label={editing ? 'Nova Senha (preencher para trocar)' : 'Senha de Acesso'} name="senha" req={!editing} def={editing?.senha} />
          <Select label="Papel (RBAC)" name="role" def={editing?.role || 'Vaqueiro'} options={Object.entries(PAPEIS).map(([val, cfg]) => ({ val, lbl: cfg.lbl }))} />
          <Select label="Status" name="status" def={editing?.status || 'Ativo'} options={['Ativo', 'Inativo']} />
        </Modal>
      )}
    </div>
  );
}
