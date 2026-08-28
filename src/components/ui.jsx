// src/components/ui.jsx — Componentes visuais reutilizáveis do GestProp
import React from 'react';
import { X } from 'lucide-react';

export const Input = ({ label, name, type = "text", req = false, def = "", ...props }) => (
  <div>
    <label className="block text-sm font-bold text-gray-700 mb-1.5">{label} {req && <span className="text-red-500">*</span>}</label>
    <input type={type} name={name} required={req} defaultValue={def} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 font-medium transition-all" {...props} />
  </div>
);

export const Select = ({ label, name, req = false, def = "", options, ...props }) => (
  <div>
    <label className="block text-sm font-bold text-gray-700 mb-1.5">{label} {req && <span className="text-red-500">*</span>}</label>
    <select name={name} required={req} defaultValue={def} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 font-medium transition-all appearance-none" {...props}>
      {options.map((o, i) => {
        const val = typeof o === 'object' && o !== null ? o.val : o;
        const lbl = typeof o === 'object' && o !== null ? o.lbl : o;
        return <option key={i} value={val}>{lbl}</option>;
      })}
    </select>
  </div>
);

export const Modal = ({ title, icon: Icon, onClose, onSubmit, formId, submitText = "Salvar", children, wide }) => (
  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className={`bg-white rounded-3xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} overflow-hidden flex flex-col max-h-[90vh] shadow-2xl`}>
      <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
        <h2 className="font-black text-lg text-gray-900 flex items-center"><Icon className="mr-2 text-green-600" /> {title}</h2>
        <button type="button" onClick={onClose} className="p-1.5 bg-white text-gray-400 hover:text-gray-800 rounded-full shadow-sm transition-colors"><X size={18} /></button>
      </div>
      <div className="overflow-y-auto p-6 custom-scrollbar">
        <form id={formId} onSubmit={onSubmit} className="space-y-4">{children}</form>
      </div>
      <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
        <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl font-bold bg-white border border-gray-200 text-gray-700 hover:bg-gray-100">Cancelar</button>
        {onSubmit && <button type="submit" form={formId} className="px-8 py-3 rounded-xl font-bold text-white bg-slate-900 hover:bg-black shadow-md">{submitText}</button>}
      </div>
    </div>
  </div>
);

export const Table = ({ headers, children }) => (
  <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden w-full">
    <div className="overflow-x-auto w-full custom-scrollbar max-h-[60vh]">
      <table className="min-w-full divide-y divide-gray-100 relative">
        <thead className="bg-gray-50 sticky top-0 z-10 backdrop-blur-md bg-opacity-90">
          <tr>{headers.map((h, i) => <th key={i} className={`px-5 py-4 text-xs font-black uppercase tracking-wider text-gray-500 whitespace-nowrap ${i === headers.length - 1 ? 'text-right' : 'text-left'}`}>{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-50 bg-white">{children}</tbody>
      </table>
    </div>
  </div>
);

export const EmptyState = ({ icon: Icon, titulo, subtitulo }) => (
  <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-12 text-center">
    <Icon size={40} className="mx-auto text-gray-300 mb-3" />
    <p className="font-black text-gray-500">{titulo}</p>
    <p className="text-sm text-gray-400 font-medium mt-1">{subtitulo}</p>
  </div>
);

export const formatCurrency = (val) => Number.isFinite(Number(val))
  ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val))
  : "R$ 0,00";

export const fmtKg = (val, dec = 1) => Number.isFinite(Number(val)) ? Number(val).toFixed(dec) : '-';

export const dataBR = (iso) => iso ? String(iso).split('-').reverse().join('/') : '-';
