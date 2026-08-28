// GestProp - Aplicação principal (reescrita e saneada)
// Correções: crash em Gestão de Usuários, JSX duplicado/órfão, views mortas
// (Nutrição e Assistente IA), tipos className, e novo módulo de Confinamento.
import React, { useState, useEffect, useMemo } from 'react';
import {
  Tractor, Beef, Activity, LogOut, Search, Plus, MapPin, DollarSign, HeartPulse,
  LayoutGrid, X, Trash2, Edit, Baby, LayoutDashboard, Scale, Settings, Sparkles, Bot, Send,
  Loader2, CheckCircle2, Download, Archive, Target, PackagePlus, AlertTriangle, ListPlus,
  ShieldAlert, Wheat, Calculator, Users, CalendarDays, Mail, MessageSquare, Save, NotebookPen,
  Cloud, CloudOff, MinusCircle, Menu, Droplets, Warehouse, TrendingUp,
  UtensilsCrossed, ClipboardList, ArrowRightLeft, Camera
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';

// --- Novos módulos (GestProp v2.0) ---
import CochoIA from './views/CochoIA';
import Agua from './views/Agua';
import Calendario from './views/Calendario';
import SanidadePro from './views/SanidadePro';
import UsuariosRBAC, { papelPodeVer, PAPEIS } from './views/UsuariosRBAC';
import { aiChat, aiAnalise, montarContexto, getDeepSeekKey, setDeepSeekKey, getDeepSeekModel, setDeepSeekModel, deepSeekConfigurado, DEEPSEEK_MODEL_DEFAULT } from './lib/ai';
import { api, apiOnline, setToken } from './lib/api';

const firebaseConfig = {
  apiKey: "AIzaSyCn_eHREYCqtCxOtM4ShWmW_O--AX-6O5I",
  authDomain: "fluent-radar-319304.firebaseapp.com",
  projectId: "fluent-radar-319304",
  storageBucket: "fluent-radar-319304.firebasestorage.app",
  messagingSenderId: "458118385254",
  appId: "1:458118385254:web:966259a4d29b6553fea7a7",
  measurementId: "G-CEXNXKX7ZF"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const defaultData = {
  propriedades: [{ id: 1, nome: "Minha Fazenda", responsavel: "Gestor", cidade: "Local", estado: "BR", area_ha: 100, ie: "" }],
  usuarios: [{ id: 1, nome: "Administrador", email: "admin@gestprop.com", senha: "admin", role: "Admin", status: "Ativo" }],
  calendarioSanitario: [
    { id: 1, propriedadeId: 1, doenca: "Febre Aftosa", mes: "Maio / Novembro", publico: "Bovinos", obrigatorio: true },
    { id: 2, propriedadeId: 1, doenca: "Brucelose", mes: "Qualquer", publico: "Fêmeas 3-8m", obrigatorio: true },
    { id: 3, propriedadeId: 1, doenca: "Raiva", mes: "Maio", publico: "Todo Rebanho", obrigatorio: true },
    { id: 4, propriedadeId: 1, doenca: "Vermifugação", mes: "Maio/Ago/Nov", publico: "Rebanho", obrigatorio: false }
  ],
  lotes: [], animais: [], pesagens: [], reproducao: [], nascimentos: [], vacinacoes: [],
  insumos: [], financeiro: [], anotacoes: [], producaoLeite: [],
  currais: [], lotesConfinamento: [], tratos: [],
  // v2.0 — novos módulos
  leiturasCocho: [], aguaRegistros: [], tarefas: [],
  sanidadeProtocolos: [], sanidadeAplicacoes: [], obitos: [], alertasAuto: [],
  bibliotecaAlimentos: [
    { id: 1, nome: "Silagem Milho", ms: 35, pb: 7.5, precoKg: 0.25 },
    { id: 2, nome: "Milho Grão", ms: 88, pb: 9.0, precoKg: 1.20 },
    { id: 3, nome: "Farelo Soja", ms: 89, pb: 46.0, precoKg: 2.10 },
    { id: 4, nome: "Núcleo Confinamento", ms: 90, pb: 30.0, precoKg: 3.50 }
  ]
};

// --- COMPONENTES UI REUTILIZÁVEIS ---
const Input = ({ label, name, type = "text", req = false, def = "", ...props }) => (
  <div>
    <label className="block text-sm font-bold text-gray-700 mb-1.5">{label} {req && <span className="text-red-500">*</span>}</label>
    <input type={type} name={name} required={req} defaultValue={def} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 font-medium transition-all" {...props} />
  </div>
);

const Select = ({ label, name, req = false, def = "", options, ...props }) => (
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

const Modal = ({ title, icon: Icon, onClose, onSubmit, formId, submitText = "Salvar", children, wide }) => (
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
        <button type="submit" form={formId} className="px-8 py-3 rounded-xl font-bold text-white bg-slate-900 hover:bg-black shadow-md">{submitText}</button>
      </div>
    </div>
  </div>
);

const Table = ({ headers, children }) => (
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

const EmptyState = ({ icon: Icon, titulo, subtitulo }) => (
  <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-12 text-center">
    <Icon size={40} className="mx-auto text-gray-300 mb-3" />
    <p className="font-black text-gray-500">{titulo}</p>
    <p className="text-sm text-gray-400 font-medium mt-1">{subtitulo}</p>
  </div>
);

// --- IA (DeepSeek via Worker Cloudflare) E UTILITÁRIOS ---
// A chave da DeepSeek pode ser configurada localmente (Configurações) ou ficar no Worker.
// Senhas locais: gravadas como hash SHA-256; valores antigos em texto puro seguem aceitos.
const sha256Hex = async (txt) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
};
const ehHashSha256 = (s) => typeof s === 'string' && /^[0-9a-f]{64}$/i.test(s);
const senhaConfere = async (gravada, digitada) =>
  ehHashSha256(gravada) ? (await sha256Hex(digitada)) === gravada.toLowerCase() : gravada === digitada;

const callIA = async (prompt, sys, ctxExtra = '') => {
  try {
    return await aiChat(prompt, ctxExtra, [], {});
  } catch (e) { return '❌ Erro ao comunicar com a IA. Verifique a conexão com o backend (VITE_API_URL).'; }
};

export default function App() {
  const [configTab, setConfigTab] = useState('sistema');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [activePropriedadeId, setActivePropriedadeId] = useState(1);
  const [selectedAnimaisIds, setSelectedAnimaisIds] = useState([]);
  // IA (DeepSeek) — chave e modelo editáveis em Configurações
  const [deepseekKey, setDeepseekKeyState] = useState(() => getDeepSeekKey());
  const [deepseekModel, setDeepseekModelState] = useState(() => getDeepSeekModel());

  // Gestão unificada de Modais
  const [selectedAnimal, setSelectedAnimal] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [consumoItem, setConsumoItem] = useState(null);

  const [aiInsights, setAiInsights] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chatMessages, setChatMessages] = useState([{ role: 'model', text: 'Olá! Sou o seu Consultor Agro IA. Como posso ajudar?' }]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [emailModalData, setEmailModalData] = useState(null);
  const [sanidadeTab, setSanidadeTab] = useState('registos');
  const [confTab, setConfTab] = useState('visao');

  // Nutrição
  const [dietaAtual, setDietaAtual] = useState([]);
  const [insumoSelecionado, setInsumoSelecionado] = useState("");
  const [pctInclusao, setPctInclusao] = useState("");
  const [nutriAlvoPeso, setNutriAlvoPeso] = useState(400);
  const [nutriAlvoGPD, setNutriAlvoGPD] = useState(1.2);

  // --- NUVEM & PERSISTÊNCIA FIREBASE ---
  const [appData, setAppData] = useState(() => {
    const saved = localStorage.getItem('bovigest_data_v1');
    if (saved) {
      try { return { ...defaultData, ...JSON.parse(saved) }; } catch (e) { return defaultData; }
    }
    return defaultData;
  });

  const [isCloudReady, setIsCloudReady] = useState(false);
  const [cloudStatus, setCloudStatus] = useState('connecting');
  const [firebaseUser, setFirebaseUser] = useState(null);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    return onAuthStateChanged(auth, setFirebaseUser);
  }, []);

  useEffect(() => {
    if (!firebaseUser || !isLoggedIn || !currentUser) return;
    const docRef = doc(db, 'bovigest_users', currentUser.email);
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) setAppData(prev => ({ ...defaultData, ...docSnap.data() }));
      setIsCloudReady(true);
      setCloudStatus('online');
    }, (err) => {
      console.error(err);
      setCloudStatus('error');
    });
    return () => unsub();
  }, [firebaseUser, isLoggedIn, currentUser]);

  const updateApp = (updater) => {
    setAppData(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (isCloudReady && currentUser) setDoc(doc(db, 'bovigest_users', currentUser.email), next).catch(console.error);
      localStorage.setItem('bovigest_data_v1', JSON.stringify(next));
      return next;
    });
    setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000);
  };

  useEffect(() => { localStorage.setItem('bovigest_data_v1', JSON.stringify(appData)); }, [appData]);

  // --- ACESSO AOS DADOS SEGURO ---
  const d = appData || defaultData;
  const arr = (v) => Array.isArray(v) ? v : [];

  const pAtiva = arr(d.propriedades).find(p => p.id === activePropriedadeId) || arr(d.propriedades)[0] || defaultData.propriedades[0];
  const cAnimais = arr(d.animais).filter(a => a.propriedadeId === activePropriedadeId);
  const cLotes = arr(d.lotes).filter(a => a.propriedadeId === activePropriedadeId);
  const cFin = arr(d.financeiro).filter(a => a.propriedadeId === activePropriedadeId);
  const cPesagens = arr(d.pesagens).filter(a => a.propriedadeId === activePropriedadeId);
  const cRep = arr(d.reproducao).filter(a => a.propriedadeId === activePropriedadeId);
  const cNasc = arr(d.nascimentos).filter(a => a.propriedadeId === activePropriedadeId);
  const cVac = arr(d.vacinacoes).filter(a => a.propriedadeId === activePropriedadeId);
  const cInsumos = arr(d.insumos).filter(a => a.propriedadeId === activePropriedadeId);
  const cCal = arr(d.calendarioSanitario).filter(a => a.propriedadeId === activePropriedadeId);
  const cAnot = arr(d.anotacoes).filter(a => a.propriedadeId === activePropriedadeId);
  const cLeite = arr(d.producaoLeite).filter(a => a.propriedadeId === activePropriedadeId);
  const cCurrais = arr(d.currais).filter(a => a.propriedadeId === activePropriedadeId);
  const cLotesConf = arr(d.lotesConfinamento).filter(a => a.propriedadeId === activePropriedadeId);
  const cTratos = arr(d.tratos).filter(a => a.propriedadeId === activePropriedadeId);
  const cBiblioteca = arr(d.bibliotecaAlimentos);
  const usuariosSistema = arr(d.usuarios);
  // v2.0 — coleções dos novos módulos
  const cLeiturasCocho = arr(d.leiturasCocho).filter(a => a.propriedadeId === activePropriedadeId);
  const cAgua = arr(d.aguaRegistros).filter(a => a.propriedadeId === activePropriedadeId);
  const cTarefas = arr(d.tarefas).filter(a => a.propriedadeId === activePropriedadeId);
  const cProtocolos = arr(d.sanidadeProtocolos).filter(a => a.propriedadeId === activePropriedadeId);
  const cAplicacoes = arr(d.sanidadeAplicacoes).filter(a => a.propriedadeId === activePropriedadeId);
  const cObitos = arr(d.obitos).filter(a => a.propriedadeId === activePropriedadeId);

  // --- CÁLCULOS ROBUSTOS ---
  const formatCurrency = (val) => Number.isFinite(Number(val)) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val)) : "R$ 0,00";
  const fmtKg = (val, dec = 1) => Number.isFinite(Number(val)) ? Number(val).toFixed(dec) : '-';

  const finStats = useMemo(() => cFin.reduce((acc, i) => {
    if (i?.status === 'pago') { i.tipo === 'receita' ? acc.r += Number(i.valor || 0) : acc.d += Number(i.valor || 0); }
    return acc;
  }, { r: 0, d: 0 }), [cFin]);

  const saldoAtual = finStats.r - finStats.d;
  const pesoMedio = cAnimais.length === 0 ? 0 : Math.round(cAnimais.reduce((acc, a) => acc + (Number(a.peso) || 0), 0) / cAnimais.length);

  const filtAnimais = useMemo(() => cAnimais.filter(a => {
    const q = String(searchQuery || '').toLowerCase();
    return String(a.brinco || '').toLowerCase().includes(q) || String(a.nome || '').toLowerCase().includes(q) || String(a.lote || '').toLowerCase().includes(q);
  }), [searchQuery, cAnimais]);

  const femeasArray = cAnimais.filter(a => a.sexo === 'F');
  const gadoDeCorte = cAnimais.filter(a => a.tipo === 'Corte');
  const totalLeiteMes = cLeite.filter(l => l.data && new Date(l.data).getMonth() === new Date().getMonth()).reduce((acc, curr) => acc + (Number(curr.litros) || 0), 0);
  const mediaLitrosVaca = femeasArray.length === 0 ? 0 : (totalLeiteMes / femeasArray.length).toFixed(1);

  const getGPD = (brinco) => {
    const p = cPesagens.filter(x => x.brinco === brinco && x.data && Number.isFinite(new Date(x.data).getTime()))
      .sort((a, b) => new Date(b.data) - new Date(a.data));
    if (p.length > 1) {
      const dias = (new Date(p[0].data) - new Date(p[1].data)) / 86400000;
      const ganho = Number(p[0].pesoAtual) - Number(p[1].pesoAtual);
      return dias > 0 && Number.isFinite(ganho) ? (ganho / dias).toFixed(2) : null;
    }
    return null;
  };

  const isEmCarencia = (lote) => { const v = cVac.find(x => x.lote === lote || x.lote === "Todo o Rebanho"); return (v && v.dataLiberacao && new Date() < new Date(v.dataLiberacao)) ? v : false; };

  // --- MÉTRICAS DE CONFINAMENTO ---
  const metricsLoteConf = (l) => {
    const tratos = cTratos.filter(t => Number(t.loteConfId) === Number(l.id));
    const kgMN = tratos.reduce((a, t) => a + (Number(t.quantidadeKg) || 0), 0);
    const custoTratos = tratos.reduce((a, t) => a + (Number(t.custoTotal) || 0), 0);
    const qtd = Number(l.qtdEntrada) || 0;
    const pesoEntMed = qtd > 0 ? (Number(l.pesoTotalEntrada) || 0) / qtd : 0;
    const encerrado = l.status === 'Encerrado';
    const fim = encerrado && l.dataSaida && Number.isFinite(new Date(l.dataSaida).getTime()) ? new Date(l.dataSaida) : new Date();
    const iniTs = new Date(l.dataEntrada).getTime();
    const dias = Number.isFinite(iniTs) ? Math.max(1, Math.round((fim - iniTs) / 86400000)) : 1;
    // Peso atual: saída registrada OU animais vinculados pelo nome do lote
    const vinc = cAnimais.filter(a => a.lote === l.nome && a.ativo !== false);
    let pesoAtualMed = null;
    if (encerrado && Number(l.pesoTotalSaida) > 0 && Number(l.qtdSaida) > 0) pesoAtualMed = Number(l.pesoTotalSaida) / Number(l.qtdSaida);
    else if (vinc.length > 0) pesoAtualMed = vinc.reduce((a, x) => a + (Number(x.peso) || 0), 0) / vinc.length;
    const gmd = (pesoAtualMed != null && pesoEntMed > 0) ? (pesoAtualMed - pesoEntMed) / dias : null;
    const qtdRef = encerrado ? (Number(l.qtdSaida) || qtd) : qtd;
    const ganhoTotal = (pesoAtualMed != null) ? Math.max(0, (pesoAtualMed - pesoEntMed) * qtdRef) : null;
    const msPct = (Number(l.msDieta) || 60) / 100;
    const kgMS = kgMN * msPct;
    const ca = (ganhoTotal && ganhoTotal > 0 && kgMS > 0) ? kgMS / ganhoTotal : null;
    // Custo por @ produzida: custo / ((ganho kg × rendimento de carcaça%) / 15 kg/@)
    const rendimento = Number(l.rendimentoCarcaca ?? l.rendimento_carcaca ?? l.rendimento_carcasa ?? 52) || 52;
    const custoArroba = (ganhoTotal && ganhoTotal > 0) ? custoTratos / ((ganhoTotal * rendimento / 100) / 15) : null;
    const cmsCab = (qtd > 0 && dias > 0) ? (kgMS / dias / qtd) : null;
    const pesoAlvo = Number(l.pesoAlvoAbate) || 560;
    const diasRest = (gmd && gmd > 0 && pesoAtualMed != null && !encerrado) ? Math.max(0, Math.round((pesoAlvo - pesoAtualMed) / gmd)) : null;
    const lucro = encerrado ? (Number(l.valorVendaTotal) || 0) - (Number(l.custoCompraTotal) || 0) - custoTratos : null;
    return { kgMN, custoTratos, dias, gmd, ca, custoArroba, pesoAtualMed, pesoEntMed, cmsCab, ganhoTotal, qtd, vincCount: vinc.length, diasRest, pesoAlvo, lucro, encerrado };
  };

  const lotesConfAtivos = cLotesConf.filter(l => l.status !== 'Encerrado');
  const lotesConfEncerrados = cLotesConf.filter(l => l.status === 'Encerrado');
  const animaisConfinados = lotesConfAtivos.reduce((a, l) => a + (Number(l.qtdEntrada) || 0), 0);
  const metricsAtivos = lotesConfAtivos.map(metricsLoteConf);
  const gmdMedio = metricsAtivos.filter(m => m.gmd != null).length ? metricsAtivos.filter(m => m.gmd != null).reduce((a, m) => a + m.gmd, 0) / metricsAtivos.filter(m => m.gmd != null).length : null;
  const custoAlimTotal = metricsAtivos.reduce((a, m) => a + m.custoTratos, 0) + lotesConfEncerrados.map(metricsLoteConf).reduce((a, m) => a + m.custoTratos, 0);

  // --- DASHBOARD: ALERTAS E ATIVIDADES ---
  const hoje = new Date();
  const animaisCarencia = cVac.filter(v => v.dataLiberacao && new Date(v.dataLiberacao) > hoje);
  const insumosCriticos = cInsumos.filter(i => Number(i.quantidade || 0) <= Number(i.estoqueMinimo || 0));
  const partosProximos = cRep.filter(r => {
    if (r.status !== 'Prenhe' || !r.previsaoParto) return false;
    const dias = (new Date(r.previsaoParto) - hoje) / 86400000;
    return dias >= -10 && dias <= 30;
  });
  const atividadesRecentes = [
    ...cPesagens.slice(-4).map(p => ({ icone: Scale, cor: 'bg-orange-100 text-orange-600', desc: `Pesagem: Brinco ${p.brinco} → ${p.pesoAtual} kg`, data: p.data })),
    ...cVac.slice(-4).map(v => ({ icone: ShieldAlert, cor: 'bg-red-100 text-red-600', desc: `Sanidade: ${v.vacina} — ${v.lote}`, data: v.dataAplicacao })),
    ...cNasc.slice(-4).map(n => ({ icone: Baby, cor: 'bg-blue-100 text-blue-600', desc: `Nascimento: ${n.brincoBezerro} (M: ${n.brincoMatriz})`, data: n.data })),
    ...cTratos.slice(-4).map(t => ({ icone: UtensilsCrossed, cor: 'bg-amber-100 text-amber-600', desc: `Trato: ${t.quantidadeKg} kg`, data: t.data })),
  ].filter(x => x.data).sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 6);

  // --- HANDLERS E FUNÇÕES ---
  const openModal = (type, item = null) => { setEditingItem(item); setModalType(type); };
  const closeModal = () => { setModalType(null); setEditingItem(null); setConsumoItem(null); };
  const handleDel = (coll, id) => { if (confirm('Confirmar remoção permanente?')) updateApp(p => ({ ...p, [coll]: arr(p[coll]).filter(x => x.id !== id) })); };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!auth.currentUser) { try { await signInAnonymously(auth); } catch (e2) { } }
    setIsLoginLoading(true); setLoginError("");
    const email = e.target.email.value.trim().toLowerCase(); const senha = e.target.senha.value;
    let loginOk = false;
    try {
      const docSnap = await getDoc(doc(db, 'bovigest_users', email));
      if (docSnap.exists()) {
        const data = docSnap.data();
        const user = arr(data.usuarios).find(u => String(u.email).toLowerCase() === email);
        if (user && await senhaConfere(user.senha, senha)) {
          setAppData({ ...defaultData, ...data }); setCurrentUser(user); setIsLoggedIn(true); loginOk = true;
        } else setLoginError("Senha incorreta.");
      } else {
        if (!confirm(`A conta "${email}" ainda não existe. Deseja criar uma nova conta local para este e-mail?`)) {
          setIsLoginLoading(false); return;
        }
        let newData = { ...defaultData };
        // Senha gravada como hash SHA-256 (nunca em texto puro)
        newData.usuarios = [{ id: Date.now(), nome: email.split('@')[0], email, senha: await sha256Hex(senha), role: "Admin", status: "Ativo" }];
        await setDoc(doc(db, 'bovigest_users', email), newData);
        setAppData(newData); setCurrentUser(newData.usuarios[0]); setIsLoggedIn(true); loginOk = true;
      }
    } catch (err) { setLoginError("Erro na nuvem. Verifique a conexão."); }
    // Autentica também no Worker (API) para habilitar recursos de nuvem/IA
    if (loginOk && apiOnline()) {
      try {
        const r = await api.login(email, senha);
        if (r?.token) setToken(r.token);
        else throw new Error('resposta sem token');
      } catch (errApi) {
        alert('Login local efetuado, mas a autenticação na API (Worker) falhou: ' + (errApi?.message || errApi) +
          '\n\nOs recursos de nuvem/IA via Worker (upload de fotos de cocho, indicadores online, IA sem chave local) ficarão indisponíveis nesta sessão. O modo local continua funcionando.');
      }
    }
    setIsLoginLoading(false);
  };

  const handleSaveForm = (e) => {
    e.preventDefault(); const fd = new FormData(e.target); const d = Object.fromEntries(fd.entries());
    d.id = editingItem?.id || Date.now();
    d.propriedadeId = activePropriedadeId;

    if (modalType === 'animal') {
      d.peso = Number(d.peso); d.ativo = true;
      updateApp(p => ({ ...p, animais: editingItem ? arr(p.animais).map(x => x.id === d.id ? d : x) : [d, ...arr(p.animais)] }));
    }
    if (modalType === 'batch') {
      const n = []; const pref = d.prefixo || ''; const qtd = Number(d.quantidade); const ini = Number(d.inicio);
      for (let i = 0; i < qtd; i++) n.push({ ...d, id: Date.now() + i, brinco: `${pref}${(ini + i).toString().padStart(3, '0')}`, nome: "-", sexo: fd.get('sexo'), categoria: fd.get('categoria'), tipo: fd.get('tipo'), raca: fd.get('raca'), dataNasc: fd.get('dataNasc'), peso: Number(d.peso), ativo: true });
      updateApp(p => ({ ...p, animais: [...n, ...arr(p.animais)] }));
    }
    if (modalType === 'lote') {
      d.capacidade = Number(d.capacidade);
      updateApp(p => ({ ...p, lotes: editingItem ? arr(p.lotes).map(x => x.id === d.id ? d : x) : [d, ...arr(p.lotes)] }));
    }
    if (modalType === 'pesagem') {
      d.pesoAtual = Number(d.pesoAtual); const an = cAnimais.find(x => x.brinco === d.brinco); if (!an && !editingItem) return alert('Brinco não encontrado.');
      d.pesoAnterior = editingItem ? editingItem.pesoAnterior : an.peso;
      updateApp(p => ({ ...p, pesagens: editingItem ? arr(p.pesagens).map(x => x.id === d.id ? d : x) : [d, ...arr(p.pesagens)], animais: arr(p.animais).map(x => x.brinco === d.brinco ? { ...x, peso: d.pesoAtual } : x) }));
    }
    if (modalType === 'financeiro') {
      d.valor = Number(d.valor); d.status = d.status || 'pago';
      updateApp(p => ({ ...p, financeiro: editingItem ? arr(p.financeiro).map(x => x.id === d.id ? d : x) : [d, ...arr(p.financeiro)] }));
    }
    if (modalType === 'reproducao') {
      d.previsaoParto = d.dataInseminacao ? new Date(new Date(d.dataInseminacao).setDate(new Date(d.dataInseminacao).getDate() + 290)).toISOString().split('T')[0] : '';
      updateApp(p => ({ ...p, reproducao: editingItem ? arr(p.reproducao).map(x => x.id === d.id ? d : x) : [d, ...arr(p.reproducao)] }));
    }
    if (modalType === 'nascimento') {
      d.pesoNascimento = Number(d.pesoNascimento);
      const cria = { id: d.id + 1, propriedadeId: activePropriedadeId, brinco: d.brincoBezerro, nome: "-", sexo: d.sexo, categoria: "Bezerro(a)", tipo: "Cria", raca: d.raca, dataNasc: d.data, peso: d.pesoNascimento, lote: "Maternidade", obs: `Cria de ${d.brincoMatriz}`, ativo: true };
      updateApp(p => ({ ...p, nascimentos: editingItem ? arr(p.nascimentos).map(x => x.id === d.id ? d : x) : [d, ...arr(p.nascimentos)], animais: editingItem ? arr(p.animais) : [cria, ...arr(p.animais)] }));
    }
    if (modalType === 'leite') {
      d.litros = Number(d.litros);
      updateApp(p => ({ ...p, producaoLeite: editingItem ? arr(p.producaoLeite).map(x => x.id === d.id ? d : x) : [d, ...arr(p.producaoLeite)] }));
    }
    if (modalType === 'vacina') {
      d.carenciaDias = Number(d.carenciaDias); d.qtdAnimais = Number(d.qtdAnimais);
      if (d.carenciaDias > 0) { const ld = new Date(d.dataAplicacao); ld.setDate(ld.getDate() + d.carenciaDias); d.dataLiberacao = ld.toISOString().split('T')[0]; }
      updateApp(p => ({ ...p, vacinacoes: editingItem ? arr(p.vacinacoes).map(x => x.id === d.id ? d : x) : [d, ...arr(p.vacinacoes)] }));
    }
    if (modalType === 'insumo') {
      d.quantidade = Number(d.quantidade); d.estoqueMinimo = Number(d.estoqueMinimo);
      updateApp(p => ({ ...p, insumos: editingItem ? arr(p.insumos).map(x => x.id === d.id ? d : x) : [d, ...arr(p.insumos)] }));
    }
    if (modalType === 'consumo') {
      const q = Number(d.quantidadeConsumo);
      updateApp(p => ({ ...p, insumos: arr(p.insumos).map(x => x.id === consumoItem.id ? { ...x, quantidade: Math.max(0, x.quantidade - q) } : x) }));
    }
    if (modalType === 'calendario') {
      d.obrigatorio = d.obrigatorio === 'true';
      updateApp(p => ({ ...p, calendarioSanitario: editingItem ? arr(p.calendarioSanitario).map(x => x.id === d.id ? d : x) : [d, ...arr(p.calendarioSanitario)] }));
    }
    if (modalType === 'anotacao') {
      d.status = 'aberto'; d.data = new Date().toLocaleDateString('pt-BR');
      updateApp(p => ({ ...p, anotacoes: [d, ...arr(p.anotacoes)] }));
    }
    if (modalType === 'propriedade') {
      d.area_ha = Number(d.area_ha);
      updateApp(p => ({ ...p, propriedades: editingItem ? arr(p.propriedades).map(x => x.id === d.id ? d : x) : [d, ...arr(p.propriedades)] }));
    }
    if (modalType === 'usuario') {
      updateApp(p => ({ ...p, usuarios: editingItem ? arr(p.usuarios).map(x => x.id === d.id ? d : x) : [d, ...arr(p.usuarios)] }));
      if (!editingItem) setEmailModalData(d);
    }
    // --- CONFINAMENTO ---
    if (modalType === 'curral') {
      d.capacidade = Number(d.capacidade);
      updateApp(p => ({ ...p, currais: editingItem ? arr(p.currais).map(x => x.id === d.id ? d : x) : [d, ...arr(p.currais)] }));
    }
    if (modalType === 'loteConf') {
      d.qtdEntrada = Number(d.qtdEntrada); d.pesoTotalEntrada = Number(d.pesoTotalEntrada);
      d.custoCompraTotal = Number(d.custoCompraTotal || 0); d.msDieta = Number(d.msDieta || 60);
      d.pesoAlvoAbate = Number(d.pesoAlvoAbate || 560); d.gmdAlvo = Number(d.gmdAlvo || 1.4);
      d.status = editingItem?.status || 'Ativo';
      updateApp(p => ({ ...p, lotesConfinamento: editingItem ? arr(p.lotesConfinamento).map(x => x.id === d.id ? { ...x, ...d } : x) : [d, ...arr(p.lotesConfinamento)] }));
    }
    if (modalType === 'trato') {
      d.loteConfId = Number(d.loteConfId); d.quantidadeKg = Number(d.quantidadeKg);
      d.custoTotal = Number(d.custoTotal || 0); d.sobraPct = Number(d.sobraPct || 0);
      updateApp(p => ({ ...p, tratos: editingItem ? arr(p.tratos).map(x => x.id === d.id ? d : x) : [d, ...arr(p.tratos)] }));
    }
    if (modalType === 'saidaConf' && editingItem) {
      updateApp(p => ({
        ...p,
        lotesConfinamento: arr(p.lotesConfinamento).map(x => x.id === editingItem.id ? {
          ...x, status: 'Encerrado', dataSaida: d.dataSaida,
          qtdSaida: Number(d.qtdSaida), pesoTotalSaida: Number(d.pesoTotalSaida),
          valorVendaTotal: Number(d.valorVendaTotal || 0), obsSaida: d.obsSaida || ''
        } : x)
      }));
    }
    if (modalType === 'alimento') {
      d.ms = Number(d.ms); d.pb = Number(d.pb); d.precoKg = Number(d.precoKg);
      updateApp(p => ({ ...p, bibliotecaAlimentos: editingItem ? arr(p.bibliotecaAlimentos).map(x => x.id === d.id ? d : x) : [d, ...arr(p.bibliotecaAlimentos)] }));
    }

    closeModal();
  };

  // --- NUTRIÇÃO: MONTAGEM DE DIETA ---
  const addInsumoDieta = () => {
    const alim = cBiblioteca.find(a => String(a.id) === String(insumoSelecionado));
    const pct = Number(pctInclusao);
    if (!alim || !(pct > 0)) return;
    setDietaAtual(prev => [...prev.filter(x => x.id !== alim.id), { id: alim.id, nome: alim.nome, pct, ms: alim.ms, pb: alim.pb, precoKg: alim.precoKg }]);
    setInsumoSelecionado(""); setPctInclusao("");
  };
  const dietaStats = useMemo(() => {
    const pctTotal = dietaAtual.reduce((a, x) => a + x.pct, 0);
    if (pctTotal <= 0) return { pctTotal: 0, ms: 0, pb: 0, custo: 0 };
    const ms = dietaAtual.reduce((a, x) => a + x.pct * (Number(x.ms) || 0), 0) / pctTotal;
    const pb = dietaAtual.reduce((a, x) => a + x.pct * (Number(x.pb) || 0), 0) / pctTotal;
    const custo = dietaAtual.reduce((a, x) => a + x.pct * (Number(x.precoKg) || 0), 0) / pctTotal;
    return { pctTotal, ms, pb, custo };
  }, [dietaAtual]);
  const consumoMSEstimado = Number(nutriAlvoPeso) * 0.022; // ~2,2% do PV
  const consumoMNDieta = dietaStats.ms > 0 ? consumoMSEstimado / (dietaStats.ms / 100) : 0;
  const custoCabDia = consumoMNDieta * dietaStats.custo;

  // --- SELEÇÃO MÚLTIPLA ---
  const toggleAnimalSelection = (id) => setSelectedAnimaisIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleAllAnimais = () => setSelectedAnimaisIds(selectedAnimaisIds.length === filtAnimais.length ? [] : filtAnimais.map(a => a.id));
  const handleDeleteMultipleAnimais = () => {
    if (confirm(`Atenção: Deseja remover permanentemente ${selectedAnimaisIds.length} animais?`)) {
      updateApp(p => ({ ...p, animais: arr(p.animais).filter(a => !selectedAnimaisIds.includes(a.id)) }));
      setSelectedAnimaisIds([]);
    }
  };

  // --- HANDLERS v2.0: cocho, água, calendário, sanidade pro, propriedades ---
  const addLeiturasCocho = (novas) => updateApp(p => ({ ...p, leiturasCocho: [...novas, ...arr(p.leiturasCocho)] }));

  const addRegistroAgua = (reg) => updateApp(p => ({ ...p, aguaRegistros: [{ ...reg, propriedadeId: activePropriedadeId }, ...arr(p.aguaRegistros)] }));
  const addAlertasAuto = (novos) => updateApp(p => ({ ...p, alertasAuto: [...novos.map(a => ({ ...a, id: Date.now() + Math.random(), propriedadeId: activePropriedadeId, lido: false })), ...arr(p.alertasAuto)] }));

  const addTarefa = (t) => updateApp(p => ({ ...p, tarefas: [{ ...t, propriedadeId: activePropriedadeId }, ...arr(p.tarefas)] }));
  const toggleTarefa = (id, novoStatus = null) => updateApp(p => ({
    ...p,
    tarefas: arr(p.tarefas).map(t => t.id === id ? { ...t, status: novoStatus || (t.status === 'Concluida' ? 'Pendente' : 'Concluida') } : t),
  }));

  // Sanidade Pro: salvar genérico por coleção (cria ou edita)
  const saveSanidade = (colecao, registro) => updateApp(p => ({
    ...p,
    [colecao]: arr(p[colecao]).some(x => x.id === registro.id)
      ? arr(p[colecao]).map(x => x.id === registro.id ? { ...registro, propriedadeId: activePropriedadeId } : x)
      : [{ ...registro, propriedadeId: activePropriedadeId }, ...arr(p[colecao])],
  }));

  // Exclusão segura de propriedade (2 etapas, arquivamento local ou expurgo via API)
  const [delProp, setDelProp] = useState(null); // { etapa: 1|2, prop, token, nomeDigitado, modo }
  const iniciarExclusaoPropriedade = (prop) => setDelProp({ etapa: 1, prop, token: null, nomeDigitado: '', modo: 'arquivamento' });
  const confirmarEtapa1 = async () => {
    if (delProp.nomeDigitado !== delProp.prop.nome) return alert('O nome digitado não confere com o nome da fazenda.');
    if (apiOnline()) {
      try {
        const r = await api.excluirPropriedadeEtapa1(delProp.prop.id, delProp.nomeDigitado, delProp.modo);
        return setDelProp({ ...delProp, etapa: 2, token: r.token });
      } catch { /* fallback local */ }
    }
    setDelProp({ ...delProp, etapa: 2, token: 'local' });
  };
  const confirmarEtapa2 = async () => {
    const id = delProp.prop.id;
    if (apiOnline() && delProp.token && delProp.token !== 'local') {
      try {
        await api.excluirPropriedadeEtapa2(id, delProp.token, delProp.modo);
      } catch (e) {
        console.error(e);
        alert(`Falha ao excluir a fazenda no servidor: ${e?.message || e}. Nada foi alterado localmente — tente novamente.`);
        return; // aborta: exclusão local só após sucesso confirmado do Worker
      }
    }
    if (delProp.modo === 'expurgo') {
      // Expurgo: remove a propriedade e todos os dados vinculados
      updateApp(p => {
        const out = { ...p, propriedades: arr(p.propriedades).filter(x => x.id !== id) };
        ['animais','lotes','pesagens','reproducao','nascimentos','vacinacoes','insumos','financeiro','anotacoes','producaoLeite','currais','lotesConfinamento','tratos','leiturasCocho','aguaRegistros','tarefas','sanidadeProtocolos','sanidadeAplicacoes','obitos','alertasAuto','calendarioSanitario']
          .forEach(k => { out[k] = arr(out[k]).filter(x => x.propriedadeId !== id); });
        return out;
      });
    } else {
      // Arquivamento: marca como arquivada, dados preservados
      updateApp(p => ({ ...p, propriedades: arr(p.propriedades).map(x => x.id === id ? { ...x, status: 'Arquivada', arquivadaEm: new Date().toISOString() } : x) }));
    }
    if (activePropriedadeId === id) {
      const rest = arr(appData.propriedades).filter(x => x.id !== id);
      if (rest[0]) setActivePropriedadeId(rest[0].id);
    }
    setDelProp(null);
  };

  // --- IA (DeepSeek) E EXPORTAÇÕES ---
  const ctxIA = () => montarContexto({
    animais: cAnimais, lotesConf: cLotesConf, tratos: cTratos,
    leiturasCocho: arr(d.leiturasCocho).filter(x => x.propriedadeId === activePropriedadeId),
    agua: arr(d.aguaRegistros).filter(x => x.propriedadeId === activePropriedadeId),
    pesoMedio, gmdMedio, saldoAtual,
  });

  const handleAnalyzeFarm = async () => {
    setIsAnalyzing(true);
    try {
      const response = await aiAnalise({
        cabecas: cAnimais.length, pesoMedio, saldoAtual,
        confinamento: { cabecas: animaisConfinados, lotesAtivos: lotesConfAtivos.length, gmdMedio, custoAlimentarTotal: custoAlimTotal },
      }, true);
      setAiInsights(response);
    } catch {
      setAiInsights(await callIA('Resumo executivo de indicadores positivos, riscos e sugestão de lucro.', '', ctxIA()));
    }
    setIsAnalyzing(false);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault(); if (!chatInput.trim()) return;
    const txt = chatInput; setChatMessages(p => [...p, { role: 'user', text: txt }]); setChatInput(""); setIsChatLoading(true);
    const aiResponse = await aiChat(txt, ctxIA(), chatMessages.slice(-10), {});
    setChatMessages(p => [...p, { role: 'model', text: aiResponse }]);
    setIsChatLoading(false);
  };

  const exportCSV = (name, hdrs, rows) => {
    const blob = new Blob(["\uFEFF" + [hdrs.join(';'), ...rows.map(r => r.map(i => `"${i ?? ''}"`).join(';'))].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const l = document.createElement('a'); l.href = URL.createObjectURL(blob); l.download = name; l.click();
  };

  // --- MENU (filtrado por papel RBAC) ---
  const navsAll = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Painel Central' },
    { id: 'animais', icon: Beef, label: 'Rebanho' },
    { id: 'confinamento', icon: Warehouse, label: 'Confinamento' },
    { id: 'cocho', icon: Camera, label: 'Cocho & IA' },
    { id: 'agua', icon: Droplets, label: 'Água' },
    { id: 'calendario', icon: CalendarDays, label: 'Calendário' },
    { id: 'gado_corte', icon: Target, label: 'Engorda' },
    { id: 'leite', icon: Droplets, label: 'Leite' },
    { id: 'pastagens', icon: LayoutGrid, label: 'Lotes' },
    { id: 'reproducao', icon: HeartPulse, label: 'Reprodução' },
    { id: 'nascimentos', icon: Baby, label: 'Nascimentos' },
    { id: 'pesagens', icon: Scale, label: 'Pesagens' },
    { id: 'sanidade', icon: ShieldAlert, label: 'Sanidade' },
    { id: 'nutricao', icon: Wheat, label: 'Nutrição' },
    { id: 'insumos', icon: Archive, label: 'Insumos' },
    { id: 'financeiro', icon: DollarSign, label: 'Financeiro' },
    { id: 'anotacoes', icon: NotebookPen, label: 'Anotações' },
    { id: 'ai-assistant', icon: Sparkles, label: 'Assistente IA' },
    { id: 'propriedades', icon: MapPin, label: 'Propriedades' },
    { id: 'configuracoes', icon: Settings, label: 'Configurações' }
  ];
  const navs = navsAll.filter(n => papelPodeVer(currentUser?.role || 'Vaqueiro', n.id)); // fail-closed: papel desconhecido → mais restrito

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #022c22 0%, #064e3b 45%, #0f172a 100%)' }}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(16,185,129,0.35) 0, transparent 40%), radial-gradient(circle at 80% 70%, rgba(16,185,129,0.2) 0, transparent 45%)' }}></div>
        <div className="relative z-10 text-center px-4 max-w-md mx-auto gp-fade-up">
          <div className="mx-auto w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl mb-6 ring-4 ring-emerald-400/20" style={{ background: 'linear-gradient(135deg, #10b981, #047857)' }}><Beef size={48} className="text-white" /></div>
          <h2 className="text-5xl font-black text-white tracking-tight">Gest<span className="text-emerald-400">Prop</span></h2>
          <p className="text-emerald-100/70 font-medium mt-2 text-sm tracking-wide">Gestão de Confinamento Bovino • Pecuária de Precisão</p>
          <div className="mt-8 bg-white/[0.07] backdrop-blur-xl p-8 rounded-3xl border border-white/10 text-left shadow-2xl">
            {loginError && <p className="text-red-400 mb-4 font-bold text-center">{loginError}</p>}
            <form className="space-y-6" onSubmit={handleLogin}>
              <Input label="Email de Acesso (Ou digite novo para criar)" name="email" type="email" req placeholder="ex: gestor@fazenda.com" />
              <Input label="Senha" name="senha" type="password" req placeholder="••••••••" />
              <button type="submit" disabled={isLoginLoading} className="w-full py-4 rounded-xl font-bold text-white shadow-lg shadow-emerald-900/40" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>{isLoginLoading ? 'A conectar...' : 'Entrar no Sistema'}</button>
            </form>
          </div>
          <p className="text-emerald-100/40 text-xs font-medium mt-6">Cocho com IA • Água • Sanidade • Desempenho • RBAC</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 text-gray-900 font-sans">
      {isMobileMenuOpen && <div className="fixed inset-0 bg-slate-950/80 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 w-72 flex flex-col z-50 transition-transform md:relative ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`} style={{ background: 'linear-gradient(180deg, #020617 0%, #022c22 100%)' }}>
        <div className="h-24 flex items-center justify-between px-6 border-b border-white/5 shrink-0">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mr-3 shadow-lg shadow-emerald-900/50" style={{ background: 'linear-gradient(135deg, #10b981, #047857)' }}><Beef size={22} className="text-white" /></div>
            <div>
              <span className="text-2xl font-black text-white leading-none">Gest<span className="text-emerald-400">Prop</span></span>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-0.5">Confinamento</p>
            </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-white"><X /></button>
        </div>
        <div className="p-6 bg-white/[0.03] border-b border-white/5 shrink-0">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-emerald-300 font-bold mr-3 shrink-0 ring-2 ring-emerald-500/30" style={{ background: 'linear-gradient(135deg, #064e3b, #022c22)' }}>{(currentUser?.nome || 'U')[0].toUpperCase()}</div>
            <div className="overflow-hidden"><p className="font-bold text-sm text-white truncate">{pAtiva.nome}</p><p className="text-[10px] font-medium text-slate-400 truncate uppercase tracking-widest">{PAPEIS[currentUser?.role]?.lbl || pAtiva.responsavel}</p></div>
          </div>
          <select value={activePropriedadeId} onChange={(e) => setActivePropriedadeId(Number(e.target.value))} className="w-full bg-slate-800/80 text-white text-sm font-bold px-3 py-2 rounded-lg outline-none border border-white/5">
            {arr(appData.propriedades).filter(p => p.status !== 'Arquivada').map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
          {navs.map(n => {
            const act = currentView === n.id;
            return (
              <button key={n.id} onClick={() => { setCurrentView(n.id); setIsMobileMenuOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl font-bold text-sm transition-all ${act ? 'text-white shadow-lg shadow-emerald-950/50' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`} style={act ? { background: 'linear-gradient(135deg, #10b981, #059669)' } : {}}>
                <n.icon className={`mr-3 h-5 w-5 ${act ? 'text-white' : 'text-slate-500'}`} /> {n.label}
              </button>
            )
          })}
        </nav>
        <div className="p-6 border-t border-slate-800/50 shrink-0">
          <button onClick={() => { setIsLoggedIn(false); setCurrentUser(null); setCloudStatus('connecting'); }} className="flex items-center justify-center w-full px-4 py-3 text-slate-400 border border-slate-700/50 hover:text-red-400 hover:bg-slate-900 rounded-xl font-bold text-sm">
            <LogOut className="mr-2 h-4 w-4" /> Terminar Sessão
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 sm:h-24 bg-white border-b flex items-center justify-between px-6 sm:px-10 shrink-0">
          <div className="flex items-center">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden mr-4 bg-gray-100 p-2 rounded-lg"><Menu /></button>
            <h2 className="text-xl sm:text-2xl font-extrabold flex items-center">
              {(() => { const C = navs.find(n => n.id === currentView)?.icon || LayoutDashboard; return <C className="mr-3 text-green-600 shrink-0" size={26} /> })()}
              {navs.find(n => n.id === currentView)?.label}
            </h2>
          </div>
          <div className="flex items-center space-x-3">
            {cloudStatus === 'online' && <span className="bg-blue-50 text-blue-600 text-xs font-bold px-3 py-1.5 rounded-full flex"><Cloud size={14} className="mr-1" /> Nuvem</span>}
            {cloudStatus === 'error' && <span className="bg-red-50 text-red-600 text-xs font-bold px-3 py-1.5 rounded-full flex"><CloudOff size={14} className="mr-1" /> Offline</span>}
            {saveSuccess && <span className="bg-green-50 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full flex"><CheckCircle2 size={14} className="mr-1" /> Salvo</span>}
          </div>
        </header>

        <div key={currentView} className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar relative gp-fade-up">

          {currentView === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                <div className="bg-white p-6 rounded-3xl border shadow-sm"><div className="bg-blue-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-4 text-blue-600"><Beef size={28} /></div><h3 className="text-4xl font-black">{cAnimais.length}</h3><p className="text-xs font-bold text-gray-400 mt-1 uppercase">Cabeças</p></div>
                <div className="bg-white p-6 rounded-3xl border shadow-sm"><div className="bg-green-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-4 text-green-600"><DollarSign size={28} /></div><h3 className="text-2xl font-black mt-2 truncate">{formatCurrency(saldoAtual)}</h3><p className="text-xs font-bold text-gray-400 mt-1 uppercase">Saldo Global</p></div>
                <div className="bg-white p-6 rounded-3xl border shadow-sm"><div className="bg-cyan-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-4 text-cyan-600"><Droplets size={28} /></div><h3 className="text-4xl font-black">{totalLeiteMes} <span className="text-lg text-gray-400">L</span></h3><p className="text-xs font-bold text-gray-400 mt-1 uppercase">Leite Mês</p></div>
                <div className="bg-white p-6 rounded-3xl border shadow-sm"><div className="bg-pink-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-4 text-pink-600"><HeartPulse size={28} /></div><h3 className="text-4xl font-black">{cRep.filter(r => r.status === 'Prenhe').length}</h3><p className="text-xs font-bold text-gray-400 mt-1 uppercase">Prenhes</p></div>
                <div className="bg-white p-5 rounded-3xl border shadow-sm"><div className="bg-rose-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-3 text-rose-500 font-black text-xl">♀</div><h3 className="text-3xl font-black text-rose-500">{cAnimais.filter(a => a.sexo === 'F').length}</h3><p className="text-xs font-bold text-gray-400 mt-1 uppercase">Fêmeas</p></div>
                <div className="bg-white p-5 rounded-3xl border shadow-sm"><div className="bg-blue-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-3 text-blue-500 font-black text-xl">♂</div><h3 className="text-3xl font-black text-blue-500">{cAnimais.filter(a => a.sexo === 'M').length}</h3><p className="text-xs font-bold text-gray-400 mt-1 uppercase">Machos</p></div>
              </div>

              {/* Alertas e Atividades */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl border shadow-sm p-6">
                  <h3 className="font-black text-lg flex items-center mb-4"><AlertTriangle size={20} className="mr-2 text-amber-500" /> Alertas</h3>
                  <div className="space-y-3">
                    {animaisCarencia.length === 0 && insumosCriticos.length === 0 && partosProximos.length === 0 && (
                      <p className="text-sm font-bold text-gray-400 flex items-center"><CheckCircle2 size={16} className="mr-2 text-green-500" /> Nenhum alerta no momento.</p>
                    )}
                    {animaisCarencia.map(v => (
                      <div key={`car-${v.id}`} className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-2xl p-3">
                        <ShieldAlert size={18} className="text-red-500 shrink-0 mt-0.5" />
                        <p className="text-sm font-bold text-red-800">Carência: {v.vacina} ({v.lote}) — liberação em {String(v.dataLiberacao).split('-').reverse().join('/')}</p>
                      </div>
                    ))}
                    {insumosCriticos.map(i => (
                      <div key={`ins-${i.id}`} className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl p-3">
                        <Archive size={18} className="text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-sm font-bold text-amber-800">Estoque crítico: {i.nome} ({i.quantidade} {i.unidade})</p>
                      </div>
                    ))}
                    {partosProximos.map(r => (
                      <div key={`par-${r.id}`} className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-2xl p-3">
                        <Baby size={18} className="text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-sm font-bold text-blue-800">Parto próximo: Vaca {r.brincoVaca} — prev. {String(r.previsaoParto).split('-').reverse().join('/')}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-3xl border shadow-sm p-6">
                  <h3 className="font-black text-lg flex items-center mb-4"><Activity size={20} className="mr-2 text-green-600" /> Atividades Recentes</h3>
                  <div className="space-y-3">
                    {atividadesRecentes.length === 0 && <p className="text-sm font-bold text-gray-400">Nenhuma atividade registrada ainda.</p>}
                    {atividadesRecentes.map((a, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${a.cor}`}><a.icone size={16} /></div>
                        <div className="flex-1 min-w-0"><p className="text-sm font-bold text-gray-800 truncate">{a.desc}</p><p className="text-xs font-medium text-gray-400">{a.data}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Resumo Confinamento no Dashboard */}
              {lotesConfAtivos.length > 0 && (
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-6 text-white shadow-lg">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-black text-lg flex items-center"><Warehouse size={20} className="mr-2 text-amber-400" /> Confinamento em andamento</h3>
                    <button onClick={() => setCurrentView('confinamento')} className="text-xs font-bold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl">Abrir módulo</button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div><p className="text-3xl font-black">{animaisConfinados}</p><p className="text-xs font-bold text-slate-400 uppercase">Cabeças</p></div>
                    <div><p className="text-3xl font-black">{lotesConfAtivos.length}</p><p className="text-xs font-bold text-slate-400 uppercase">Lotes ativos</p></div>
                    <div><p className="text-3xl font-black">{gmdMedio ? gmdMedio.toFixed(2) : '-'}</p><p className="text-xs font-bold text-slate-400 uppercase">GMD médio (kg/d)</p></div>
                    <div><p className="text-3xl font-black truncate">{formatCurrency(custoAlimTotal)}</p><p className="text-xs font-bold text-slate-400 uppercase">Custo alimentar</p></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentView === 'animais' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <div className="relative flex-1 max-w-md"><Search className="absolute left-4 top-3.5 text-gray-400 w-5 h-5" /><input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Pesquisar brinco, lote..." className="w-full pl-12 pr-4 py-3 bg-white border rounded-2xl outline-none focus:ring-2 focus:ring-green-500" /></div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => exportCSV('rebanho.csv', ['Brinco', 'Nome', 'Sexo', 'Categoria', 'Raça', 'Lote', 'Peso', 'Nascimento'], filtAnimais.map(a => [a.brinco, a.nome, a.sexo, a.categoria, a.raca, a.lote, a.peso, a.dataNasc]))} className="bg-white border text-gray-700 font-bold px-5 py-3 rounded-2xl flex items-center hover:bg-gray-50"><Download size={18} className="mr-2" /> CSV</button>
                  {selectedAnimaisIds.length > 0 ? (
                    <button onClick={handleDeleteMultipleAnimais} className="bg-red-600 text-white font-bold px-6 py-3 rounded-2xl flex items-center"><Trash2 size={18} className="mr-2" /> Remover {selectedAnimaisIds.length}</button>
                  ) : (
                    <><button onClick={() => openModal('batch')} className="bg-indigo-600 text-white font-bold px-6 py-3 rounded-2xl flex items-center"><ListPlus size={18} className="mr-2" /> Lote</button><button onClick={() => openModal('animal')} className="bg-green-600 text-white font-bold px-6 py-3 rounded-2xl flex items-center"><Plus size={18} className="mr-2" /> Único</button></>
                  )}
                </div>
              </div>
              <Table headers={['Sel.', 'Animal', 'Sexo', 'Lote', 'Peso', 'Ações']}>
                {filtAnimais.map(a => (
                  <tr key={a.id} className={selectedAnimaisIds.includes(a.id) ? 'bg-green-50' : 'hover:bg-gray-50'}>
                    <td className="px-5 py-4 text-center"><input type="checkbox" checked={selectedAnimaisIds.includes(a.id)} onChange={() => toggleAnimalSelection(a.id)} className="w-4 h-4 text-green-600" /></td>
                    <td className="px-5 py-4 flex items-center gap-4"><div className="w-12 h-12 bg-green-100 text-green-700 font-black rounded-xl flex items-center justify-center text-sm">{a.brinco}</div><div><div className="font-black text-sm">{a.nome !== '-' ? a.nome : `Brinco ${a.brinco}`}</div><div className="text-xs text-gray-500 font-medium">{a.raca} • {a.categoria} • <span className={`font-bold ${a.sexo === 'F' ? 'text-rose-500' : 'text-blue-500'}`}>{a.sexo === 'F' ? '♀ fêmea' : '♂ macho'}</span></div></div></td>
                    <td className="px-5 py-4 text-center"><span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold ${a.sexo === 'F' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>{a.sexo === 'F' ? '♀ Fêmea' : '♂ Macho'}</span></td>
                    <td className="px-5 py-4"><span className="bg-gray-100 text-gray-700 font-bold px-3 py-1.5 rounded-lg text-xs">{a.lote}</span></td>
                    <td className="px-5 py-4 text-right font-black text-lg">{a.peso} <span className="text-xs text-gray-400">kg</span></td>
                    <td className="px-5 py-4 text-right">
                      <button onClick={() => setSelectedAnimal(a)} className="bg-white border text-gray-700 font-bold px-4 py-2 rounded-xl text-xs hover:bg-gray-50 mr-2 shadow-sm">Ficha</button>
                      <button onClick={() => openModal('animal', a)} className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg"><Edit size={18} /></button>
                    </td>
                  </tr>
                ))}
              </Table>
              {filtAnimais.length === 0 && <EmptyState icon={Beef} titulo="Nenhum animal encontrado" subtitulo="Cadastre um animal único ou em lote para começar." />}
            </div>
          )}

          {currentView === 'confinamento' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-center">
                <div className="bg-white border rounded-xl p-1 flex flex-wrap">
                  {[['visao', 'Visão Geral'], ['currais', 'Currais'], ['lotes', 'Lotes'], ['tratos', 'Tratos / Cocho']].map(([id, lbl]) => (
                    <button key={id} onClick={() => setConfTab(id)} className={`px-5 py-2 text-sm font-bold rounded-lg ${confTab === id ? 'bg-amber-50 text-amber-700 shadow-sm' : 'text-gray-500'}`}>{lbl}</button>
                  ))}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => openModal('trato')} disabled={lotesConfAtivos.length === 0} className="bg-amber-500 disabled:opacity-40 text-white font-bold px-5 py-3 rounded-2xl flex items-center"><UtensilsCrossed size={18} className="mr-2" /> Trato</button>
                  <button onClick={() => openModal('loteConf')} className="bg-slate-900 text-white font-bold px-5 py-3 rounded-2xl flex items-center"><PackagePlus size={18} className="mr-2" /> Entrada de Lote</button>
                </div>
              </div>

              {confTab === 'visao' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    <div className="bg-white p-6 rounded-3xl border shadow-sm"><div className="bg-amber-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-3 text-amber-600"><Warehouse size={24} /></div><h3 className="text-3xl font-black">{animaisConfinados}</h3><p className="text-xs font-bold text-gray-400 mt-1 uppercase">Cabeças confinadas</p></div>
                    <div className="bg-white p-6 rounded-3xl border shadow-sm"><div className="bg-slate-100 w-12 h-12 rounded-2xl flex items-center justify-center mb-3 text-slate-600"><ClipboardList size={24} /></div><h3 className="text-3xl font-black">{lotesConfAtivos.length}</h3><p className="text-xs font-bold text-gray-400 mt-1 uppercase">Lotes ativos</p></div>
                    <div className="bg-white p-6 rounded-3xl border shadow-sm"><div className="bg-green-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-3 text-green-600"><TrendingUp size={24} /></div><h3 className="text-3xl font-black">{gmdMedio ? gmdMedio.toFixed(2) : '-'}</h3><p className="text-xs font-bold text-gray-400 mt-1 uppercase">GMD médio (kg/d)</p></div>
                    <div className="bg-white p-6 rounded-3xl border shadow-sm"><div className="bg-orange-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-3 text-orange-600"><UtensilsCrossed size={24} /></div><h3 className="text-3xl font-black">{cTratos.length}</h3><p className="text-xs font-bold text-gray-400 mt-1 uppercase">Tratos lançados</p></div>
                    <div className="bg-white p-6 rounded-3xl border shadow-sm col-span-2 sm:col-span-1"><div className="bg-red-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-3 text-red-600"><DollarSign size={24} /></div><h3 className="text-xl font-black truncate">{formatCurrency(custoAlimTotal)}</h3><p className="text-xs font-bold text-gray-400 mt-1 uppercase">Custo alimentar total</p></div>
                  </div>

                  {lotesConfAtivos.length === 0 ? (
                    <EmptyState icon={Warehouse} titulo="Nenhum lote em confinamento" subtitulo="Registre a entrada de um lote para acompanhar GMD, conversão alimentar e custo por arroba." />
                  ) : (
                    <Table headers={['Lote / Curral', 'Dias', 'Peso Ent. → Atual', 'GMD', 'Prev. Abate', 'Custo Alim.']}>
                      {lotesConfAtivos.map(l => {
                        const m = metricsLoteConf(l);
                        return (
                          <tr key={l.id} className="hover:bg-gray-50">
                            <td className="px-5 py-4"><span className="font-black block">{l.nome}</span><span className="text-xs font-bold text-gray-500">{l.curralNome || 'Sem curral'} • {m.qtd} cab • entrada {l.dataEntrada}</span></td>
                            <td className="px-5 py-4 font-black">{m.dias} d</td>
                            <td className="px-5 py-4 font-bold text-sm">{fmtKg(m.pesoEntMed, 0)} kg → {m.pesoAtualMed != null ? `${fmtKg(m.pesoAtualMed, 0)} kg` : 'sem vínculo'}</td>
                            <td className={`px-5 py-4 font-black ${m.gmd != null && m.gmd >= (Number(l.gmdAlvo) || 1.4) ? 'text-green-600' : 'text-amber-600'}`}>{m.gmd != null ? `${m.gmd.toFixed(2)} kg/d` : '-'}</td>
                            <td className="px-5 py-4 font-bold text-sm">{m.diasRest != null ? `~${m.diasRest} dias (${m.pesoAlvo} kg)` : '-'}</td>
                            <td className="px-5 py-4 text-right font-black">{formatCurrency(m.custoTratos)}</td>
                          </tr>
                        );
                      })}
                    </Table>
                  )}

                  {lotesConfEncerrados.length > 0 && (
                    <div>
                      <h3 className="font-black text-lg mb-3 text-gray-700">Resultados de lotes encerrados</h3>
                      <Table headers={['Lote', 'Período', 'GMD Real', 'Conv. Alim.', 'Custo/@', 'Resultado']}>
                        {lotesConfEncerrados.map(l => {
                          const m = metricsLoteConf(l);
                          return (
                            <tr key={l.id} className="hover:bg-gray-50">
                              <td className="px-5 py-4"><span className="font-black block">{l.nome}</span><span className="text-xs font-bold text-gray-500">{l.qtdSaida || l.qtdEntrada} cab vendidas</span></td>
                              <td className="px-5 py-4 font-bold text-sm">{l.dataEntrada} → {l.dataSaida} ({m.dias} d)</td>
                              <td className="px-5 py-4 font-black">{m.gmd != null ? `${m.gmd.toFixed(2)} kg/d` : '-'}</td>
                              <td className="px-5 py-4 font-bold">{m.ca != null ? `${m.ca.toFixed(1)}:1` : '-'}</td>
                              <td className="px-5 py-4 font-bold">{m.custoArroba != null ? formatCurrency(m.custoArroba) : '-'}</td>
                              <td className={`px-5 py-4 text-right font-black ${m.lucro != null && m.lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>{m.lucro != null ? formatCurrency(m.lucro) : '-'}</td>
                            </tr>
                          );
                        })}
                      </Table>
                    </div>
                  )}
                </div>
              )}

              {confTab === 'currais' && (
                <div className="space-y-6">
                  <div className="flex justify-end"><button onClick={() => openModal('curral')} className="bg-green-600 text-white font-bold px-6 py-3 rounded-2xl flex items-center"><Plus size={18} className="mr-2" /> Novo Curral</button></div>
                  {cCurrais.length === 0 ? <EmptyState icon={Warehouse} titulo="Nenhum curral cadastrado" subtitulo="Cadastre currais e baias para controlar a ocupação do confinamento." /> : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      {cCurrais.map(c => {
                        const lotesNoCurral = lotesConfAtivos.filter(l => l.curralNome === c.nome);
                        const ocup = lotesNoCurral.reduce((a, l) => a + (Number(l.qtdEntrada) || 0), 0);
                        const oc = c.capacidade > 0 ? Math.round((ocup / c.capacidade) * 100) : 0;
                        return (
                          <div key={c.id} className="bg-white p-6 rounded-3xl border shadow-sm">
                            <div className="flex justify-between mb-4"><h4 className="font-black text-lg truncate pr-2">{c.nome}</h4><div className="flex shrink-0 gap-1"><button onClick={() => openModal('curral', c)} className="text-blue-500"><Edit size={16} /></button><button onClick={() => handleDel('currais', c.id)} className="text-red-500"><Trash2 size={16} /></button></div></div>
                            <p className="text-xs font-bold text-gray-400 uppercase mb-2">{c.tipo || 'Curral'} {c.obs ? `• ${c.obs}` : ''}</p>
                            <div className="flex justify-between items-end mb-2"><span className="text-3xl font-black">{ocup}</span><span className="text-xs font-bold text-gray-400">/ {c.capacidade} cab</span></div>
                            <div className="w-full bg-gray-100 h-2 rounded-full"><div className={`h-full rounded-full ${oc > 90 ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(oc, 100)}%` }}></div></div>
                            {lotesNoCurral.length > 0 && <p className="text-xs font-bold text-gray-500 mt-3">Lotes: {lotesNoCurral.map(l => l.nome).join(', ')}</p>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {confTab === 'lotes' && (
                <div className="space-y-6">
                  {cLotesConf.length === 0 ? <EmptyState icon={PackagePlus} titulo="Nenhuma entrada registrada" subtitulo="Clique em 'Entrada de Lote' para iniciar um confinamento." /> : (
                    <Table headers={['Lote', 'Entrada', 'Cabeças', 'Peso Médio Ent.', 'Status', 'Ações']}>
                      {cLotesConf.map(l => (
                        <tr key={l.id} className="hover:bg-gray-50">
                          <td className="px-5 py-4"><span className="font-black block">{l.nome}</span><span className="text-xs font-bold text-gray-500">{l.curralNome || 'Sem curral'}{l.dieta ? ` • ${l.dieta}` : ''}</span></td>
                          <td className="px-5 py-4 font-bold text-sm">{l.dataEntrada}</td>
                          <td className="px-5 py-4 font-black">{l.qtdEntrada}</td>
                          <td className="px-5 py-4 font-bold">{fmtKg((Number(l.pesoTotalEntrada) || 0) / (Number(l.qtdEntrada) || 1), 0)} kg</td>
                          <td className="px-5 py-4"><span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${l.status === 'Encerrado' ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'}`}>{l.status || 'Ativo'}</span></td>
                          <td className="px-5 py-4 text-right whitespace-nowrap">
                            {l.status !== 'Encerrado' && <button onClick={() => openModal('saidaConf', l)} className="text-amber-600 font-bold text-xs bg-amber-50 px-3 py-1.5 rounded-lg mr-2"><ArrowRightLeft size={14} className="inline mr-1" /> Saída</button>}
                            <button onClick={() => openModal('loteConf', l)} className="text-blue-500 p-2"><Edit size={18} /></button>
                            <button onClick={() => handleDel('lotesConfinamento', l.id)} className="text-red-500 p-2"><Trash2 size={18} /></button>
                          </td>
                        </tr>
                      ))}
                    </Table>
                  )}
                  <p className="text-xs font-medium text-gray-400">Dica: para GMD em tempo real, cadastre os animais do confinamento no módulo Rebanho usando o mesmo nome do lote no campo "Lote Destino".</p>
                </div>
              )}

              {confTab === 'tratos' && (
                <div className="space-y-6">
                  {cTratos.length === 0 ? <EmptyState icon={UtensilsCrossed} titulo="Nenhum trato registrado" subtitulo="Lance o fornecimento diário de ração e a leitura de cocho (sobra)." /> : (
                    <Table headers={['Data', 'Lote', 'Qtd (kg MN)', 'Custo', 'Sobra Cocho', 'Ações']}>
                      {[...cTratos].sort((a, b) => new Date(b.data) - new Date(a.data)).map(t => {
                        const lote = cLotesConf.find(l => Number(l.id) === Number(t.loteConfId));
                        return (
                          <tr key={t.id} className="hover:bg-gray-50">
                            <td className="px-5 py-4 font-bold text-sm">{t.data}</td>
                            <td className="px-5 py-4 font-black">{lote ? lote.nome : '—'}</td>
                            <td className="px-5 py-4 font-bold">{fmtKg(t.quantidadeKg)} kg</td>
                            <td className="px-5 py-4 font-bold">{formatCurrency(t.custoTotal)}</td>
                            <td className="px-5 py-4"><span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${Number(t.sobraPct) > 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{t.sobraPct || 0}%</span></td>
                            <td className="px-5 py-4 text-right"><button onClick={() => openModal('trato', t)} className="text-blue-500 p-2"><Edit size={18} /></button><button onClick={() => handleDel('tratos', t.id)} className="text-red-500 p-2"><Trash2 size={18} /></button></td>
                          </tr>
                        );
                      })}
                    </Table>
                  )}
                </div>
              )}
            </div>
          )}

          {currentView === 'cocho' && (
            <CochoIA
              lotesConfAtivos={lotesConfAtivos}
              leituras={cLeiturasCocho}
              onAddLeituras={addLeiturasCocho}
              propriedadeId={activePropriedadeId}
            />
          )}

          {currentView === 'agua' && (
            <Agua
              currais={cCurrais}
              lotesConfAtivos={lotesConfAtivos}
              registros={cAgua}
              onAdd={addRegistroAgua}
              onAlertas={addAlertasAuto}
            />
          )}

          {currentView === 'calendario' && (
            <Calendario
              tarefas={cTarefas}
              onAdd={addTarefa}
              onToggle={toggleTarefa}
              lotesConfAtivos={lotesConfAtivos}
            />
          )}

          {currentView === 'gado_corte' && (
            <div className="space-y-6"><Table headers={['Animal', 'Lote', 'Peso']}>{gadoDeCorte.map(a => (<tr key={a.id} className="hover:bg-gray-50"><td className="px-5 py-4 font-black">{a.brinco} <span className="text-xs text-gray-500 font-medium">{a.raca}</span></td><td className="px-5 py-4 font-bold text-sm">{a.lote}</td><td className="px-5 py-4 text-right font-black">{a.peso} kg</td></tr>))}</Table>
              {gadoDeCorte.length === 0 && <EmptyState icon={Target} titulo="Sem gado de corte" subtitulo="Animais com aptidão 'Corte' aparecem aqui." />}
            </div>
          )}

          {currentView === 'leite' && (
            <div className="space-y-6">
              <div className="flex justify-between"><h3 className="text-2xl font-black flex items-center"><Droplets className="mr-3 text-cyan-500" /> Leite</h3><button onClick={() => openModal('leite')} className="bg-cyan-600 text-white font-bold px-6 py-3 rounded-2xl flex items-center"><Plus size={18} className="mr-2" /> Ordenha</button></div>
              <div className="grid grid-cols-2 gap-4"><div className="bg-white border p-6 rounded-3xl text-center shadow-sm"><h3 className="text-4xl font-black">{totalLeiteMes} <span className="text-gray-400 text-xl">L</span></h3><p className="text-xs font-bold text-gray-400 uppercase mt-2">Neste Mês</p></div><div className="bg-white border p-6 rounded-3xl text-center shadow-sm"><h3 className="text-4xl font-black">{mediaLitrosVaca} <span className="text-gray-400 text-xl">L/dia</span></h3><p className="text-xs font-bold text-gray-400 uppercase mt-2">Média por Vaca</p></div></div>
              <Table headers={['Data/Turno', 'Matriz', 'Volume', 'Ações']}>{cLeite.map(l => (<tr key={l.id} className="hover:bg-cyan-50/50"><td className="px-5 py-4"><span className="font-black block">{l.data}</span><span className="text-xs font-bold text-gray-500">{l.turno}</span></td><td className="px-5 py-4 font-bold"><span className="bg-gray-100 px-3 py-1.5 rounded-lg">{l.brincoMatriz === 'TODAS' ? 'Rebanho (Total)' : `Vaca ${l.brincoMatriz}`}</span></td><td className="px-5 py-4 text-right font-black text-cyan-600 text-lg">{l.litros} L</td><td className="px-5 py-4 text-right"><button onClick={() => openModal('leite', l)} className="text-blue-500 p-2"><Edit size={18} /></button><button onClick={() => handleDel('producaoLeite', l.id)} className="text-red-500 p-2"><Trash2 size={18} /></button></td></tr>))}</Table>
            </div>
          )}

          {currentView === 'pastagens' && (
            <div className="space-y-6"><div className="flex justify-between"><h3 className="text-2xl font-black flex items-center"><LayoutGrid className="mr-3 text-green-600" /> Lotes</h3><button onClick={() => openModal('lote')} className="bg-green-600 text-white font-bold px-6 py-3 rounded-2xl flex items-center"><Plus size={18} className="mr-2" /> Novo Lote</button></div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">{cLotes.map(l => { const an = cAnimais.filter(a => a.lote === l.nome).length; const oc = Math.round((an / l.capacidade) * 100) || 0; return (<div key={l.id} className="bg-white p-6 rounded-3xl border shadow-sm"><div className="flex justify-between mb-4"><h4 className="font-black text-lg truncate pr-2">{l.nome}</h4><div className="flex shrink-0 gap-1"><button onClick={() => openModal('lote', l)} className="text-blue-500"><Edit size={16} /></button><button onClick={() => handleDel('lotes', l.id)} className="text-red-500"><Trash2 size={16} /></button></div></div><div className="flex justify-between items-end mb-2"><span className="text-3xl font-black">{an}</span><span className="text-xs font-bold text-gray-400">/ {l.capacidade}</span></div><div className="w-full bg-gray-100 h-2 rounded-full"><div className={`h-full rounded-full ${oc > 90 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(oc, 100)}%` }}></div></div></div>) })}</div>
              {cLotes.length === 0 && <EmptyState icon={LayoutGrid} titulo="Nenhum lote cadastrado" subtitulo="Crie lotes/pastos para organizar o rebanho." />}
            </div>
          )}

          {currentView === 'reproducao' && (
            <div className="space-y-6"><div className="flex justify-between"><h3 className="text-2xl font-black flex items-center"><HeartPulse className="mr-3 text-pink-600" /> Reprodução</h3><button onClick={() => openModal('reproducao')} className="bg-pink-600 text-white font-bold px-6 py-3 rounded-2xl flex items-center"><Plus size={18} className="mr-2" /> Inseminar</button></div>
              <Table headers={['Matriz', 'Método/Data', 'Prev. Parto', 'Status', 'Ações']}>{cRep.map(r => (<tr key={r.id} className="hover:bg-gray-50"><td className="px-5 py-4 font-black">{r.brincoVaca}</td><td className="px-5 py-4"><span className="block font-bold">{r.dataInseminacao}</span><span className="text-xs text-gray-500">{r.metodo} - {r.reprodutor}</span></td><td className="px-5 py-4 font-bold">{r.previsaoParto || '-'}</td><td className="px-5 py-4 text-right"><span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${r.status === 'Prenhe' ? 'bg-green-100 text-green-700' : r.status === 'Aguardando DG' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>{r.status}</span></td><td className="px-5 py-4 text-right"><button onClick={() => openModal('reproducao', r)} className="text-blue-500 p-2"><Edit size={18} /></button><button onClick={() => handleDel('reproducao', r.id)} className="text-red-500 p-2"><Trash2 size={18} /></button></td></tr>))}</Table>
            </div>
          )}

          {currentView === 'nascimentos' && (
            <div className="space-y-6"><div className="flex justify-between"><h3 className="text-2xl font-black flex items-center"><Baby className="mr-3 text-blue-500" /> Nascimentos</h3><button onClick={() => openModal('nascimento')} className="bg-blue-600 text-white font-bold px-6 py-3 rounded-2xl flex items-center"><Plus size={18} className="mr-2" /> Parto</button></div>
              <Table headers={['Data', 'Matriz > Cria', 'Sexo', 'Peso', 'Ações']}>{cNasc.map(n => (<tr key={n.id} className="hover:bg-gray-50"><td className="px-5 py-4 font-bold text-sm">{n.data}</td><td className="px-5 py-4"><span className="block font-black">M: {n.brincoMatriz}</span><span className="text-xs font-bold text-blue-600">B: {n.brincoBezerro}</span></td><td className="px-5 py-4 font-bold text-sm">{n.sexo}</td><td className="px-5 py-4 text-right font-black">{n.pesoNascimento} kg</td><td className="px-5 py-4 text-right"><button onClick={() => openModal('nascimento', n)} className="text-blue-500 p-2"><Edit size={18} /></button><button onClick={() => handleDel('nascimentos', n.id)} className="text-red-500 p-2"><Trash2 size={18} /></button></td></tr>))}</Table>
            </div>
          )}

          {currentView === 'pesagens' && (
            <div className="space-y-6"><div className="flex justify-between"><h3 className="text-2xl font-black flex items-center"><Scale className="mr-3 text-orange-500" /> Pesagens</h3><button onClick={() => openModal('pesagem')} className="bg-orange-600 text-white font-bold px-6 py-3 rounded-2xl flex items-center"><Plus size={18} className="mr-2" /> Pesagem</button></div>
              <Table headers={['Brinco', 'Anterior', 'Atual', 'Evolução', 'Ações']}>{cPesagens.map(p => { const df = (p.pesoAtual || 0) - (p.pesoAnterior || 0); return (<tr key={p.id} className="hover:bg-gray-50"><td className="px-5 py-4"><span className="block font-black">{p.brinco}</span><span className="text-xs text-gray-500 font-bold">{p.data}</span></td><td className="px-5 py-4 text-right font-bold text-gray-500">{p.pesoAnterior} kg</td><td className="px-5 py-4 text-right font-black text-lg">{p.pesoAtual} kg</td><td className={`px-5 py-4 text-right font-black ${df >= 0 ? 'text-green-600' : 'text-red-600'}`}>{df > 0 ? '+' : ''}{df} kg</td><td className="px-5 py-4 text-right"><button onClick={() => openModal('pesagem', p)} className="text-blue-500 p-2"><Edit size={18} /></button><button onClick={() => handleDel('pesagens', p.id)} className="text-red-500 p-2"><Trash2 size={18} /></button></td></tr>); })}</Table>
            </div>
          )}

          {currentView === 'sanidade' && (
            <SanidadePro
              protocolos={cProtocolos}
              aplicacoes={cAplicacoes}
              obitos={cObitos}
              lotesConfAtivos={lotesConfAtivos}
              lotes={cLotes}
              animais={cAnimais}
              onSave={saveSanidade}
              onDelete={handleDel}
            />
          )}

          {currentView === 'nutricao' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Montagem de Dieta */}
                <div className="bg-white rounded-3xl border shadow-sm p-6">
                  <h3 className="font-black text-lg flex items-center mb-4"><Wheat size={20} className="mr-2 text-amber-500" /> Montar Dieta</h3>
                  <div className="flex gap-2 mb-4">
                    <select value={insumoSelecionado} onChange={e => setInsumoSelecionado(e.target.value)} className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none font-medium">
                      <option value="">Selecione o alimento...</option>
                      {cBiblioteca.map(a => <option key={a.id} value={a.id}>{a.nome} (MS {a.ms}% • {formatCurrency(a.precoKg)}/kg)</option>)}
                    </select>
                    <input type="number" value={pctInclusao} onChange={e => setPctInclusao(e.target.value)} placeholder="%" className="w-24 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none font-bold text-center" />
                    <button onClick={addInsumoDieta} className="bg-green-600 text-white font-bold px-5 rounded-xl"><Plus size={18} /></button>
                  </div>
                  <div className="space-y-2 mb-4">
                    {dietaAtual.map(x => (
                      <div key={x.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                        <span className="font-bold text-sm">{x.nome}</span>
                        <div className="flex items-center gap-3"><span className="font-black text-sm">{x.pct}%</span><button onClick={() => setDietaAtual(prev => prev.filter(y => y.id !== x.id))} className="text-red-400"><Trash2 size={14} /></button></div>
                      </div>
                    ))}
                    {dietaAtual.length === 0 && <p className="text-sm font-medium text-gray-400 text-center py-4">Adicione alimentos para compor a dieta.</p>}
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className={`rounded-xl p-3 ${Math.abs(dietaStats.pctTotal - 100) < 0.01 ? 'bg-green-50' : 'bg-amber-50'}`}><p className="font-black">{fmtKg(dietaStats.pctTotal, 0)}%</p><p className="text-[10px] font-bold text-gray-500 uppercase">Inclusão</p></div>
                    <div className="bg-gray-50 rounded-xl p-3"><p className="font-black">{fmtKg(dietaStats.ms)}%</p><p className="text-[10px] font-bold text-gray-500 uppercase">MS</p></div>
                    <div className="bg-gray-50 rounded-xl p-3"><p className="font-black">{fmtKg(dietaStats.pb)}%</p><p className="text-[10px] font-bold text-gray-500 uppercase">PB</p></div>
                    <div className="bg-gray-50 rounded-xl p-3"><p className="font-black">{formatCurrency(dietaStats.custo)}</p><p className="text-[10px] font-bold text-gray-500 uppercase">R$/kg MN</p></div>
                  </div>
                </div>
                {/* Simulador de Custo */}
                <div className="bg-white rounded-3xl border shadow-sm p-6">
                  <h3 className="font-black text-lg flex items-center mb-4"><Calculator size={20} className="mr-2 text-green-600" /> Simulador de Custo/Cabeça</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div><label className="block text-sm font-bold text-gray-700 mb-1.5">Peso Médio (kg)</label><input type="number" value={nutriAlvoPeso} onChange={e => setNutriAlvoPeso(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none font-bold" /></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1.5">GMD Alvo (kg/d)</label><input type="number" step="0.1" value={nutriAlvoGPD} onChange={e => setNutriAlvoGPD(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none font-bold" /></div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center bg-gray-50 rounded-xl px-4 py-3"><span className="text-sm font-bold text-gray-600">Consumo MS estimado (2,2% PV)</span><span className="font-black">{fmtKg(consumoMSEstimado)} kg MS/dia</span></div>
                    <div className="flex justify-between items-center bg-gray-50 rounded-xl px-4 py-3"><span className="text-sm font-bold text-gray-600">Consumo da dieta (matéria natural)</span><span className="font-black">{fmtKg(consumoMNDieta)} kg MN/dia</span></div>
                    <div className="flex justify-between items-center bg-green-50 border border-green-100 rounded-xl px-4 py-3"><span className="text-sm font-bold text-green-800">Custo alimentar por cabeça/dia</span><span className="font-black text-green-700 text-lg">{formatCurrency(custoCabDia)}</span></div>
                    <div className="flex justify-between items-center bg-gray-50 rounded-xl px-4 py-3"><span className="text-sm font-bold text-gray-600">Custo por kg de ganho (ao GMD alvo)</span><span className="font-black">{Number(nutriAlvoGPD) > 0 ? formatCurrency(custoCabDia / Number(nutriAlvoGPD)) : '-'}</span></div>
                  </div>
                </div>
              </div>
              {/* Biblioteca de Alimentos */}
              <div>
                <div className="flex justify-between items-center mb-3"><h3 className="font-black text-lg text-gray-700">Biblioteca de Alimentos</h3><button onClick={() => openModal('alimento')} className="bg-amber-500 text-white font-bold px-5 py-2.5 rounded-2xl flex items-center text-sm"><Plus size={16} className="mr-2" /> Alimento</button></div>
                <Table headers={['Alimento', 'MS %', 'PB %', 'Preço/kg', 'Ações']}>
                  {cBiblioteca.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4 font-black text-sm">{a.nome}</td>
                      <td className="px-5 py-4 font-bold">{a.ms}%</td>
                      <td className="px-5 py-4 font-bold">{a.pb ?? '-'}%</td>
                      <td className="px-5 py-4 font-bold">{formatCurrency(a.precoKg)}</td>
                      <td className="px-5 py-4 text-right"><button onClick={() => openModal('alimento', a)} className="text-blue-500 p-2"><Edit size={18} /></button><button onClick={() => handleDel('bibliotecaAlimentos', a.id)} className="text-red-500 p-2"><Trash2 size={18} /></button></td>
                    </tr>
                  ))}
                </Table>
              </div>
            </div>
          )}

          {currentView === 'financeiro' && (
            <div className="space-y-6"><div className="flex justify-between"><h3 className="text-2xl font-black flex items-center"><DollarSign className="mr-3 text-green-600" /> Financeiro</h3><div className="flex gap-2"><button onClick={() => exportCSV('financeiro.csv', ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor'], cFin.map(f => [f.data, f.descricao, f.categoria, f.tipo, f.valor]))} className="bg-white border text-gray-700 font-bold px-5 py-3 rounded-2xl flex items-center hover:bg-gray-50"><Download size={18} className="mr-2" /> CSV</button><button onClick={() => openModal('financeiro')} className="bg-green-600 text-white font-bold px-6 py-3 rounded-2xl flex items-center"><Plus size={18} className="mr-2" /> Lançar</button></div></div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4"><div className="bg-white border p-6 rounded-2xl shadow-sm"><p className="text-xs font-bold text-gray-400 uppercase">Receitas</p><p className="text-2xl font-black text-green-600">{formatCurrency(finStats.r)}</p></div><div className="bg-white border p-6 rounded-2xl shadow-sm"><p className="text-xs font-bold text-gray-400 uppercase">Despesas</p><p className="text-2xl font-black text-red-600">{formatCurrency(finStats.d)}</p></div><div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg"><p className="text-xs font-bold text-slate-400 uppercase">Saldo</p><p className={`text-2xl font-black ${saldoAtual >= 0 ? 'text-white' : 'text-red-400'}`}>{formatCurrency(saldoAtual)}</p></div></div>
              <Table headers={['Data/Descrição', 'Cat', 'Valor', 'Ações']}>{cFin.map(f => (<tr key={f.id} className="hover:bg-gray-50"><td className="px-5 py-4"><span className="block font-black text-sm">{f.descricao}</span><span className="text-xs font-bold text-gray-500">{f.data}</span></td><td className="px-5 py-4 font-bold text-sm">{f.categoria}</td><td className={`px-5 py-4 text-right font-black ${f.tipo === 'receita' ? 'text-green-600' : 'text-red-600'}`}>{f.tipo === 'receita' ? '+' : '-'}{formatCurrency(f.valor)}</td><td className="px-5 py-4 text-right"><button onClick={() => openModal('financeiro', f)} className="text-blue-500 p-2"><Edit size={18} /></button><button onClick={() => handleDel('financeiro', f.id)} className="text-red-500 p-2"><Trash2 size={18} /></button></td></tr>))}</Table>
            </div>
          )}

          {currentView === 'insumos' && (
            <div className="space-y-6"><div className="flex justify-between"><h3 className="text-2xl font-black flex items-center"><Archive className="mr-3 text-purple-600" /> Insumos</h3><button onClick={() => openModal('insumo')} className="bg-purple-600 text-white font-bold px-6 py-3 rounded-2xl flex items-center"><Plus size={18} className="mr-2" /> Produto</button></div>
              <Table headers={['Produto', 'Qtd', 'Ações']}>{cInsumos.map(i => (<tr key={i.id} className="hover:bg-purple-50/50"><td className="px-5 py-4"><span className="block font-black text-sm">{i.nome}</span><span className="text-xs font-bold text-gray-500">{i.categoria}</span></td><td className="px-5 py-4 text-right"><span className="block font-black">{i.quantidade} {i.unidade}</span>{i.quantidade <= i.estoqueMinimo && <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded">Crítico</span>}</td><td className="px-5 py-4 text-right"><button onClick={() => { setConsumoItem(i); setModalType('consumo'); }} className="text-orange-500 font-bold text-xs bg-orange-50 px-3 py-1.5 rounded-lg mr-2"><MinusCircle size={14} className="inline mr-1" /> Consumo</button><button onClick={() => openModal('insumo', i)} className="text-blue-500 p-2"><Edit size={18} /></button><button onClick={() => handleDel('insumos', i.id)} className="text-red-500 p-2"><Trash2 size={18} /></button></td></tr>))}</Table>
            </div>
          )}

          {currentView === 'anotacoes' && (
            <div className="space-y-6"><div className="flex justify-between"><h3 className="text-2xl font-black flex items-center"><NotebookPen className="mr-3 text-amber-600" /> Anotações</h3><button onClick={() => openModal('anotacao')} className="bg-amber-600 text-white font-bold px-6 py-3 rounded-2xl flex items-center"><Plus size={18} className="mr-2" /> Nota</button></div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">{cAnot.map(n => (<div key={n.id} className={`bg-white p-6 rounded-2xl border shadow-sm flex flex-col transition-all ${n.status === 'resolvido' ? 'opacity-60' : ''}`}><div className="flex justify-between items-start mb-2"><h4 className={`font-black flex-1 pr-2 ${n.status === 'resolvido' ? 'line-through' : ''}`}>{n.titulo}</h4><button onClick={() => handleDel('anotacoes', n.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button></div><p className="text-sm text-gray-600 flex-1 whitespace-pre-wrap mt-2 mb-4">{n.texto}</p><button onClick={() => { updateApp(p => ({ ...p, anotacoes: p.anotacoes.map(a => a.id === n.id ? { ...a, status: a.status === 'resolvido' ? 'aberto' : 'resolvido' } : a) })) }} className="w-full py-2.5 font-bold rounded-xl text-sm bg-gray-100 text-gray-700 hover:bg-gray-200">{n.status === 'resolvido' ? 'Reabrir' : 'Marcar Resolvido'}</button></div>))}</div>
              {cAnot.length === 0 && <EmptyState icon={NotebookPen} titulo="Sem anotações" subtitulo="Registre lembretes e ocorrências da fazenda." />}
            </div>
          )}

          {currentView === 'ai-assistant' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-6 text-white flex flex-col sm:flex-row justify-between gap-4 sm:items-center shadow-lg">
                <div><h3 className="font-black text-xl flex items-center"><Bot size={24} className="mr-3 text-green-400" /> Consultor Agro IA</h3><p className="text-slate-400 text-sm font-medium mt-1">Análise executiva da fazenda e chat especializado (DeepSeek — chave configurada em Configurações).</p></div>
                <button onClick={handleAnalyzeFarm} disabled={isAnalyzing} className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-2xl flex items-center shrink-0">{isAnalyzing ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Sparkles size={18} className="mr-2" />} Analisar Fazenda</button>
              </div>
              {aiInsights && <div className="bg-white rounded-3xl border shadow-sm p-6"><h4 className="font-black text-sm text-gray-400 uppercase mb-3">Análise Executiva</h4><p className="text-sm font-medium text-gray-800 whitespace-pre-wrap leading-relaxed">{aiInsights}</p></div>}
              <div className="bg-white rounded-3xl border shadow-sm overflow-hidden flex flex-col" style={{ minHeight: '420px' }}>
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {chatMessages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] px-5 py-3 rounded-2xl text-sm font-medium whitespace-pre-wrap ${m.role === 'user' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-800'}`}>{m.text}</div>
                    </div>
                  ))}
                  {isChatLoading && <div className="flex justify-start"><div className="bg-gray-100 px-5 py-3 rounded-2xl"><Loader2 size={18} className="animate-spin text-gray-400" /></div></div>}
                </div>
                <div className="p-4 border-t bg-gray-50">
                  <form onSubmit={handleSendMessage} className="relative flex items-center">
                    <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Pergunte sobre manejo, nutrição, confinamento..." className="w-full pl-6 pr-14 py-4 bg-white border rounded-full outline-none focus:ring-2 focus:ring-green-500 font-medium shadow-sm" disabled={isChatLoading} />
                    <button type="submit" disabled={!chatInput.trim() || isChatLoading} className="absolute right-2 p-3 bg-green-600 text-white rounded-full hover:bg-green-700 disabled:opacity-50 shadow-md"><Send size={18} /></button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {currentView === 'propriedades' && (
            <div className="space-y-6">
              <div className="flex justify-between"><h3 className="text-2xl font-black flex items-center"><MapPin className="mr-3 text-blue-500" /> Fazendas</h3><button onClick={() => openModal('propriedade')} className="bg-blue-600 text-white font-bold px-6 py-3 rounded-2xl flex items-center"><Plus size={18} className="mr-2" /> Fazenda</button></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {arr(appData.propriedades).map((p) => (
                  <div key={p.id} className={`bg-white p-6 rounded-3xl border shadow-sm ${activePropriedadeId === p.id ? 'ring-2 ring-green-500' : ''} ${p.status === 'Arquivada' ? 'opacity-60' : ''}`}>
                    <div className="flex justify-between">
                      <h4 className="font-black text-2xl">{p.nome} {p.status === 'Arquivada' && <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-lg align-middle">Arquivada</span>}</h4>
                      <div className="flex gap-1">
                        <button onClick={() => openModal('propriedade', p)} className="text-blue-500 p-2"><Edit size={18} /></button>
                        {currentUser?.role === 'Admin' && arr(appData.propriedades).filter(x => x.status !== 'Arquivada').length > 1 && (
                          <button onClick={() => iniciarExclusaoPropriedade(p)} className="text-red-500 p-2" title="Exclusão segura (2 etapas)"><Trash2 size={18} /></button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm font-bold text-gray-500 mt-2">{p.cidade} - {p.estado}</p>
                    {p.status !== 'Arquivada' && (
                      <button onClick={() => setActivePropriedadeId(p.id)} disabled={activePropriedadeId === p.id} className={`w-full py-3 mt-6 rounded-xl font-bold transition-all ${activePropriedadeId === p.id ? 'bg-gray-100 text-gray-400' : 'bg-gray-900 text-white'}`}>{activePropriedadeId === p.id ? 'Em Uso' : 'Entrar'}</button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs font-medium text-gray-400">A exclusão de uma fazenda exige confirmação em duas etapas (nome + token) e pode ser feita por arquivamento (dados preservados) ou expurgo definitivo dos dados.</p>
            </div>
          )}

          {currentView === 'configuracoes' && (
            <div className="space-y-6">
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setConfigTab('sistema')} className={`px-4 py-2 rounded-xl border text-sm font-bold transition ${configTab === 'sistema' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>Sistema</button>
                <button onClick={() => setConfigTab('usuarios')} className={`px-4 py-2 rounded-xl border text-sm font-bold transition ${configTab === 'usuarios' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>Gestão de Usuários</button>
              </div>

              {configTab === 'sistema' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-3xl border p-8 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Dados da Fazenda Ativa ({pAtiva.nome})</h3>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.target);
                      updateApp(p => ({ ...p, propriedades: arr(p.propriedades).map(x => x.id === pAtiva.id ? { ...x, nome: fd.get('nome'), responsavel: fd.get('responsavel'), cidade: fd.get('cidade'), estado: fd.get('estado') } : x) }));
                    }} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input label="Nome da Fazenda" name="nome" req def={pAtiva.nome} />
                        <Input label="Proprietário / Responsável" name="responsavel" req def={pAtiva.responsavel} />
                        <Input label="Município" name="cidade" req def={pAtiva.cidade} />
                        <Input label="UF" name="estado" req maxLength={2} def={pAtiva.estado} />
                      </div>
                      <button type="submit" className="bg-green-600 hover:bg-green-500 text-white font-bold px-8 py-3 rounded-xl flex items-center"><Save size={18} className="mr-2" /> Salvar Dados</button>
                    </form>
                  </div>

                  <div className="bg-white rounded-3xl border p-8 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Assistente IA (DeepSeek)</h3>
                    <p className="text-sm text-gray-500 mb-4">O assistente usa <strong>somente a API oficial da DeepSeek</strong>. Cole sua chave (<a href="https://platform.deepseek.com" target="_blank" rel="noreferrer" className="text-green-600 underline">platform.deepseek.com</a>) — ela fica salva apenas neste navegador.</p>
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input type="password" placeholder="Cole sua chave DeepSeek (sk-...)" value={deepseekKey} onChange={(e) => setDeepseekKeyState(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500" />
                      </div>
                      <div className="flex gap-2">
                        <input type="text" placeholder="Modelo" value={deepseekModel} onChange={(e) => setDeepseekModelState(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500" />
                        <button onClick={() => { setDeepSeekKey(deepseekKey.trim()); setDeepSeekModel(deepseekModel.trim() || DEEPSEEK_MODEL_DEFAULT); alert('Configuração da IA salva!'); }} className="bg-green-500 hover:bg-green-600 text-white font-bold px-6 py-2 rounded-xl flex items-center gap-2 shrink-0"><Save size={18} /> Salvar</button>
                      </div>
                    </div>
                    {deepSeekConfigurado()
                      ? <p className="mt-3 text-green-600 text-sm flex items-center gap-1"><CheckCircle2 size={16} /> Chave configurada. Assistente IA ativo com o modelo <code>{getDeepSeekModel()}</code>.</p>
                      : <p className="mt-3 text-amber-600 text-sm flex items-center gap-1"><AlertTriangle size={16} /> Sem chave — o Assistente IA ficará indisponível até a configuração.</p>}
                    <p className="mt-2 text-xs text-gray-400">Modelo padrão: <code>{DEEPSEEK_MODEL_DEFAULT}</code>. Se a conta não tiver acesso ao modelo configurado, o sistema usa <code>deepseek-v4-flash</code> automaticamente.</p>
                  </div>

                  <div className="rounded-3xl border p-8 text-center shadow-sm text-white" style={{ background: 'linear-gradient(135deg, #022c22, #064e3b)' }}>
                    <Tractor size={48} className="mx-auto text-emerald-400 mb-4" />
                    <h3 className="font-black text-xl">GestProp</h3>
                    <p className="text-emerald-100/70 mt-1">Versão 2.0 — Gestão de Confinamento Bovino</p>
                    <p className="text-emerald-100/40 text-sm mt-2">Cocho com IA • Água • Sanidade • Calendário • RBAC</p>
                  </div>
                </div>
              )}

              {configTab === 'usuarios' && (
                <UsuariosRBAC
                  usuarios={usuariosSistema}
                  currentUser={currentUser}
                  onSave={(u) => updateApp(p => ({ ...p, usuarios: arr(p.usuarios).some(x => x.id === u.id) ? arr(p.usuarios).map(x => x.id === u.id ? u : x) : [...arr(p.usuarios), u] }))}
                  onDelete={(id) => handleDel('usuarios', id)}
                />
              )}
            </div>
          )}

        </div>
      </main>

      {/* --- MODAL DE DETALHES DO ANIMAL --- */}
      {selectedAnimal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
            <div className={`bg-gradient-to-r ${isEmCarencia(selectedAnimal.lote) ? 'from-red-700 to-red-600' : 'from-slate-800 to-slate-700'} p-8 flex justify-between items-start text-white shrink-0`}>
              <div><h2 className="text-4xl font-black mb-1">{selectedAnimal.nome !== '-' ? selectedAnimal.nome : `Bovino #${selectedAnimal.brinco}`}</h2><p className="text-white/80 font-bold text-lg">Brinco: {selectedAnimal.brinco} • {selectedAnimal.raca} • {selectedAnimal.categoria}</p>{isEmCarencia(selectedAnimal.lote) && (<div className="mt-4 bg-white/20 inline-flex items-center px-4 py-2 rounded-xl backdrop-blur-md"><ShieldAlert size={20} className="mr-2 text-white" /><span className="font-bold text-white">Animal em Carência até {isEmCarencia(selectedAnimal.lote).dataLiberacao.split('-').reverse().join('/')}</span></div>)}</div>
              <button onClick={() => setSelectedAnimal(null)} className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><X size={24} /></button>
            </div>
            <div className="p-8 overflow-y-auto bg-slate-50 space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4"><div className="bg-white p-5 rounded-2xl border shadow-sm"><p className="text-xs font-bold text-gray-400 uppercase">Peso Atual</p><p className="text-3xl font-black mt-1">{selectedAnimal.peso} <span className="text-base text-gray-400">kg</span></p></div><div className="bg-white p-5 rounded-2xl border shadow-sm"><p className="text-xs font-bold text-gray-400 uppercase">Lote</p><p className="text-xl font-black mt-2 truncate">{selectedAnimal.lote}</p></div><div className="bg-white p-5 rounded-2xl border shadow-sm"><p className="text-xs font-bold text-gray-400 uppercase">Idade Aprox.</p><p className="text-xl font-black mt-2 truncate">{(() => { const dn = new Date(selectedAnimal.dataNasc); return Number.isFinite(dn.getTime()) ? `${Math.floor((Date.now() - dn.getTime()) / (1000 * 60 * 60 * 24 * 30))} m` : '-'; })()}</p></div><div className="bg-white p-5 rounded-2xl border shadow-sm"><p className="text-xs font-bold text-gray-400 uppercase">GMD</p><p className="text-xl font-black mt-2 truncate">{getGPD(selectedAnimal.brinco) || '-'} <span className="text-sm text-gray-400">kg/d</span></p></div></div>
              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden"><div className="px-5 py-3 bg-gray-50 border-b flex items-center gap-2"><MessageSquare size={15} className="text-green-600" /><span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Observações</span></div><div className="p-4"><textarea rows={3} defaultValue={selectedAnimal.obs || ""} onBlur={(e) => { const obs = e.target.value; updateApp(p => ({ ...p, animais: p.animais.map(a => a.id === selectedAnimal.id ? { ...a, obs } : a) })); setSelectedAnimal(prev => ({ ...prev, obs })); }} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 resize-none font-medium text-sm" placeholder="Anotações sobre este animal..." /></div></div>
            </div>
            <div className="p-6 border-t bg-white flex justify-between shrink-0"><button onClick={() => { handleDel('animais', selectedAnimal.id); setSelectedAnimal(null); }} className="bg-red-50 text-red-600 px-6 py-4 rounded-xl font-bold flex items-center"><Trash2 size={18} className="mr-2" /> Eliminar</button><button onClick={() => { openModal('animal', selectedAnimal); setSelectedAnimal(null); }} className="bg-slate-900 text-white px-8 py-4 rounded-xl font-bold flex items-center shadow-lg"><Edit size={18} className="mr-3" /> Editar Ficha</button></div>
          </div>
        </div>
      )}

      {/* --- MODAIS DE FORMULÁRIO --- */}
      {modalType === 'animal' && (
        <Modal title={editingItem ? 'Editar Animal' : 'Novo Animal'} icon={Beef} formId="f_ani" onClose={closeModal} onSubmit={handleSaveForm} wide>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Input label="Brinco" name="brinco" req def={editingItem?.brinco} />
            <Input label="Nome (Opcional)" name="nome" def={editingItem?.nome !== '-' ? editingItem?.nome : ''} />
            <Input label="Peso Atual (kg)" name="peso" type="number" req def={editingItem?.peso} />
            <Select label="Lote Destino" name="lote" def={editingItem?.lote} options={[{ val: '', lbl: 'Sem Lote' }, ...cLotes.map(l => ({ val: l.nome, lbl: l.nome })), ...cLotesConf.filter(l => l.status !== 'Encerrado').map(l => ({ val: l.nome, lbl: `🔒 ${l.nome} (Conf.)` }))]} />
            <Select label="Aptidão/Tipo" name="tipo" def={editingItem?.tipo || 'Corte'} options={['Corte', 'Leite']} />
            <Select label="Sexo" name="sexo" def={editingItem?.sexo || 'F'} options={[{ val: 'F', lbl: 'Fêmea' }, { val: 'M', lbl: 'Macho' }]} />
            <Select label="Categoria" name="categoria" def={editingItem?.categoria || 'Bezerro(a)'} options={['Bezerro(a)', 'Novilha', 'Garrote', 'Vaca', 'Boi Gordo', 'Touro']} />
            <Input label="Raça" name="raca" req def={editingItem?.raca || 'Nelore'} />
            <div className="sm:col-span-2"><Input label="Data Nasc." name="dataNasc" type="date" req def={editingItem?.dataNasc || today} /></div>
          </div>
        </Modal>
      )}

      {modalType === 'batch' && (
        <Modal title="Cadastrar Animais em Lote" icon={ListPlus} formId="f_batch" onClose={closeModal} onSubmit={handleSaveForm} wide submitText="Gerar Lote">
          <div className="grid grid-cols-3 gap-4 mb-2">
            <Input label="Prefixo" name="prefixo" placeholder="NEL-" />
            <Input label="Início" name="inicio" type="number" req def="1" />
            <Input label="Qtd" name="quantidade" type="number" req def="10" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Raça Base" name="raca" req def="Nelore" />
            <Input label="Peso Base (kg)" name="peso" type="number" req def="200" />
            <Select label="Lote Destino" name="lote" options={[{ val: '', lbl: 'Sem Lote' }, ...cLotes.map(l => ({ val: l.nome, lbl: l.nome })), ...cLotesConf.filter(l => l.status !== 'Encerrado').map(l => ({ val: l.nome, lbl: `🔒 ${l.nome} (Conf.)` }))]} />
            <Select label="Categoria Geral" name="categoria" options={['Bezerros(as)', 'Novilhas', 'Garrotes', 'Vacas', 'Touros', 'Bois Gordos']} def="Bezerros(as)" />
            <input type="hidden" name="sexo" value="F" /><input type="hidden" name="tipo" value="Corte" /><input type="hidden" name="dataNasc" value={today} />
          </div>
        </Modal>
      )}

      {modalType === 'lote' && (
        <Modal title={editingItem ? 'Editar Lote' : 'Novo Lote/Pasto'} icon={LayoutGrid} formId="f_lote" onClose={closeModal} onSubmit={handleSaveForm}>
          <Input label="Nome do Lote" name="nome" req def={editingItem?.nome} />
          <div className="grid grid-cols-2 gap-4"><Input label="Capacidade Máx" name="capacidade" type="number" req def={editingItem?.capacidade} /><Select label="Tipo" name="tipo" def={editingItem?.tipo || 'Pasto'} options={['Pasto', 'Baia']} /></div>
          <div><label className="block text-sm font-bold text-gray-700 mb-1.5">Observações</label><textarea name="obs" rows={2} defaultValue={editingItem?.obs || ''} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 resize-none font-medium text-sm"></textarea></div>
        </Modal>
      )}

      {modalType === 'pesagem' && (
        <Modal title={editingItem ? 'Editar Pesagem' : 'Nova Pesagem'} icon={Scale} formId="f_pes" onClose={closeModal} onSubmit={handleSaveForm}>
          <Input label="Brinco do Animal" name="brinco" req def={editingItem?.brinco} />
          <Input label="Peso Atual na Balança (kg)" name="pesoAtual" type="number" step="0.1" req def={editingItem?.pesoAtual} />
          <Input label="Data da Pesagem" name="data" type="date" req def={editingItem?.data || today} />
        </Modal>
      )}

      {modalType === 'reproducao' && (
        <Modal title={editingItem ? 'Editar Inseminação' : 'Registo Reprodutivo'} icon={HeartPulse} formId="f_rep" onClose={closeModal} onSubmit={handleSaveForm}>
          <Select label="Matriz" name="brincoVaca" req options={[{ val: '', lbl: 'Selecione...' }, ...femeasArray.map(a => ({ val: a.brinco, lbl: `Vaca ${a.brinco}` }))]} def={editingItem?.brincoVaca} />
          <Input label="Identificação do Sêmen/Touro" name="reprodutor" req def={editingItem?.reprodutor} />
          <div className="grid grid-cols-2 gap-4"><Input label="Data Protocolo" name="dataProtocolo" type="date" def={editingItem?.dataProtocolo} /><Input label="Data IA/Monta" name="dataInseminacao" type="date" req def={editingItem?.dataInseminacao || today} /></div>
          <div className="grid grid-cols-2 gap-4"><Select label="Método" name="metodo" def={editingItem?.metodo || 'IA'} options={['IA', 'IATF', 'TE', 'Monta Natural']} /><Select label="Status (DG)" name="status" def={editingItem?.status || 'Aguardando DG'} options={['Aguardando DG', 'Prenhe', 'Vazia', 'Aborto']} /></div>
        </Modal>
      )}

      {modalType === 'nascimento' && (
        <Modal title="Registo de Parto" icon={Baby} formId="f_nasc" onClose={closeModal} onSubmit={handleSaveForm} submitText="Registar Parto">
          <div className="grid grid-cols-2 gap-4"><Select label="Matriz" name="brincoMatriz" req options={[{ val: '', lbl: 'Selecionar...' }, ...femeasArray.map(a => ({ val: a.brinco, lbl: a.brinco }))]} /><Input label="Novo Brinco (Cria)" name="brincoBezerro" req /></div>
          <div className="grid grid-cols-3 gap-4"><Select label="Sexo" name="sexo" options={[{ val: 'M', lbl: 'Macho' }, { val: 'F', lbl: 'Fêmea' }]} /><Input label="Peso" name="pesoNascimento" type="number" req def="35" /><Input label="Data" name="data" type="date" req def={today} /></div>
          <Input label="Raça Predominante" name="raca" req def="Nelore" />
          <div><label className="block text-sm font-bold text-gray-700 mb-1.5">Observações (Opcional)</label><input name="obs" className="w-full px-4 py-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-green-500 font-medium text-sm" /></div>
        </Modal>
      )}

      {modalType === 'leite' && (
        <Modal title={editingItem ? 'Editar Ordenha' : 'Nova Ordenha'} icon={Droplets} formId="f_leite" onClose={closeModal} onSubmit={handleSaveForm}>
          <Select label="Vaca Lactante" name="brincoMatriz" req options={[{ val: '', lbl: 'Selecione...' }, { val: 'TODAS', lbl: 'Total Diário (Lançamento Único)' }, ...femeasArray.map(a => ({ val: a.brinco, lbl: `Vaca ${a.brinco}` }))]} def={editingItem?.brincoMatriz} />
          <div className="grid grid-cols-2 gap-4"><Input label="Litros" name="litros" type="number" step="0.1" req def={editingItem?.litros} /><Select label="Turno" name="turno" def={editingItem?.turno || 'Manhã'} options={['Manhã', 'Tarde', 'Noite']} /></div>
          <Input label="Data" name="data" type="date" req def={editingItem?.data || today} />
        </Modal>
      )}

      {modalType === 'vacina' && (
        <Modal title={editingItem ? 'Editar Tratamento' : 'Sanidade Lote'} icon={ShieldAlert} formId="f_vac" onClose={closeModal} onSubmit={handleSaveForm}>
          <Input label="Medicamento / Vacina" name="vacina" req def={editingItem?.vacina} />
          <div className="grid grid-cols-2 gap-4"><Select label="Lote Alvo" name="lote" def={editingItem?.lote || 'Todo o Rebanho'} options={[{ val: 'Todo o Rebanho', lbl: 'Rebanho Todo' }, ...cLotes.map(l => ({ val: l.nome, lbl: l.nome }))]} /><Input label="Cabeças" name="qtdAnimais" type="number" req def={editingItem?.qtdAnimais || 1} /></div>
          <div className="grid grid-cols-2 gap-4"><Input label="Data Aplicação" name="dataAplicacao" type="date" req def={editingItem?.dataAplicacao || today} /><Input label="Carência Leite/Corte (Dias)" name="carenciaDias" type="number" req def={editingItem?.carenciaDias || 0} /></div>
        </Modal>
      )}

      {modalType === 'calendario' && (
        <Modal title={editingItem ? 'Editar Evento' : 'Agendar Evento Anual'} icon={CalendarDays} formId="f_cal" onClose={closeModal} onSubmit={handleSaveForm}>
          <Input label="Campanha ou Doença" name="doenca" req def={editingItem?.doenca} />
          <Select label="Mês Anual" name="mes" def={editingItem?.mes || 'Janeiro'} options={['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro', 'Qualquer']} />
          <Input label="Público Alvo (Ex: Bezerros)" name="publico" req def={editingItem?.publico} />
          <Select label="Obrigatório (Oficial)?" name="obrigatorio" def={editingItem ? String(editingItem.obrigatorio) : 'true'} options={[{ val: 'true', lbl: 'Sim (Oficial)' }, { val: 'false', lbl: 'Não (Manejo)' }]} />
        </Modal>
      )}

      {modalType === 'insumo' && (
        <Modal title={editingItem ? 'Editar Insumo' : 'Novo Insumo'} icon={Archive} formId="f_ins" onClose={closeModal} onSubmit={handleSaveForm}>
          <Input label="Produto" name="nome" req def={editingItem?.nome} />
          <div className="grid grid-cols-2 gap-4"><Input label="Categoria" name="categoria" req def={editingItem?.categoria || 'Nutrição'} /><Input label="Unidade (kg, L)" name="unidade" req def={editingItem?.unidade} /></div>
          <div className="grid grid-cols-2 gap-4"><Input label="Qtd Entrada" name="quantidade" type="number" step="0.1" req def={editingItem?.quantidade} /><Input label="Alerta de Mínimo" name="estoqueMinimo" type="number" step="0.1" req def={editingItem?.estoqueMinimo || 10} /></div>
        </Modal>
      )}

      {modalType === 'consumo' && consumoItem && (
        <Modal title="Lançar Consumo" icon={MinusCircle} formId="f_cons" onClose={closeModal} onSubmit={handleSaveForm} submitText="Consumir">
          <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl mb-4"><p className="text-xs font-bold text-orange-600 uppercase tracking-widest">Estoque Atual</p><p className="text-2xl font-black text-orange-900">{consumoItem.quantidade} <span className="text-sm font-bold text-orange-700">{consumoItem.unidade}</span></p><p className="text-sm font-bold text-gray-700 mt-1">{consumoItem.nome}</p></div>
          <Input label={`Retirar do Estoque (${consumoItem.unidade})`} name="quantidadeConsumo" type="number" step="0.1" req max={consumoItem.quantidade} autoFocus />
        </Modal>
      )}

      {modalType === 'financeiro' && (
        <Modal title={editingItem ? 'Editar Lançamento' : 'Lançamento Financeiro'} icon={DollarSign} formId="f_fin" onClose={closeModal} onSubmit={handleSaveForm}>
          <Input label="Descrição" name="descricao" req def={editingItem?.descricao} />
          <div className="grid grid-cols-2 gap-4"><Select label="Fluxo" name="tipo" def={editingItem?.tipo || 'receita'} options={[{ val: 'receita', lbl: 'Receita (+)' }, { val: 'despesa', lbl: 'Despesa (-)' }]} /><Input label="Valor (R$)" name="valor" type="number" step="0.01" req def={editingItem?.valor} /></div>
          <div className="grid grid-cols-2 gap-4"><Input label="Data" name="data" type="date" req def={editingItem?.data || today} /><Input label="Categoria" name="categoria" req def={editingItem?.categoria || 'Geral'} /></div>
        </Modal>
      )}

      {modalType === 'anotacao' && (
        <Modal title="Nova Anotação" icon={NotebookPen} formId="f_ano" onClose={closeModal} onSubmit={handleSaveForm}>
          <Input label="Título" name="titulo" req />
          <Input label="Tag (Opcional)" name="tag" placeholder="Ex: Urgente, Nutrição..." />
          <div><label className="block text-sm font-bold text-gray-700 mb-1.5">Descrição *</label><textarea required name="texto" rows={4} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 font-medium text-sm resize-none"></textarea></div>
        </Modal>
      )}

      {modalType === 'propriedade' && (
        <Modal title={editingItem ? 'Editar Fazenda' : 'Nova Fazenda'} icon={MapPin} formId="f_prop" onClose={closeModal} onSubmit={handleSaveForm}>
          <Input label="Nome Comercial" name="nome" req def={editingItem?.nome} />
          <Input label="Responsável Legal" name="responsavel" req def={editingItem?.responsavel} />
          <div className="grid grid-cols-2 gap-4"><Input label="Município" name="cidade" req def={editingItem?.cidade || 'Rondonópolis'} /><Input label="UF" name="estado" maxLength={2} req def={editingItem?.estado || 'MT'} /></div>
          <div className="grid grid-cols-2 gap-4"><Input label="Área Total (Hectares)" name="area_ha" type="number" req def={editingItem?.area_ha} /><Input label="Inscrição Estadual" name="ie" def={editingItem?.ie} /></div>
        </Modal>
      )}

      {modalType === 'usuario' && (
        <Modal title={editingItem ? 'Editar Operador' : 'Novo Convite'} icon={Users} formId="f_usr" onClose={closeModal} onSubmit={handleSaveForm}>
          <Input label="Nome Completo" name="nome" req def={editingItem?.nome} />
          <Input label="Email de Login" name="email" type="email" req def={editingItem?.email} />
          <Input label="Senha de Acesso" name="senha" req def={editingItem?.senha} placeholder="Defina uma senha..." />
          <Select label="Nível de Permissão" name="role" def={editingItem?.role || 'Operador'} options={['Operador', 'Admin']} />
        </Modal>
      )}

      {/* --- MODAIS DO CONFINAMENTO --- */}
      {modalType === 'curral' && (
        <Modal title={editingItem ? 'Editar Curral' : 'Novo Curral / Baia'} icon={Warehouse} formId="f_cur" onClose={closeModal} onSubmit={handleSaveForm}>
          <Input label="Nome do Curral" name="nome" req def={editingItem?.nome} placeholder="Ex: Curral 01" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Capacidade (cabeças)" name="capacidade" type="number" req def={editingItem?.capacidade || 100} />
            <Select label="Tipo" name="tipo" def={editingItem?.tipo || 'Curral'} options={['Curral', 'Baia', 'Curral de manejo']} />
          </div>
          <Input label="Observações" name="obs" def={editingItem?.obs} placeholder="Ex: Cocho linear 40m, bebedouro..." />
        </Modal>
      )}

      {modalType === 'loteConf' && (
        <Modal title={editingItem ? 'Editar Lote de Confinamento' : 'Entrada de Lote no Confinamento'} icon={PackagePlus} formId="f_lconf" onClose={closeModal} onSubmit={handleSaveForm} wide submitText={editingItem ? 'Salvar' : 'Registrar Entrada'}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nome do Lote" name="nome" req def={editingItem?.nome} placeholder="Ex: Lote Confinamento 2026-A" />
            <Select label="Curral Destino" name="curralNome" def={editingItem?.curralNome} options={[{ val: '', lbl: 'Sem curral' }, ...cCurrais.map(c => ({ val: c.nome, lbl: c.nome }))]} />
            <Input label="Data de Entrada" name="dataEntrada" type="date" req def={editingItem?.dataEntrada || today} />
            <Input label="Nº de Cabeças" name="qtdEntrada" type="number" req def={editingItem?.qtdEntrada} />
            <Input label="Peso Total na Entrada (kg)" name="pesoTotalEntrada" type="number" step="0.1" req def={editingItem?.pesoTotalEntrada} />
            <Input label="Custo de Compra do Lote (R$)" name="custoCompraTotal" type="number" step="0.01" def={editingItem?.custoCompraTotal} placeholder="Opcional" />
            <Input label="Dieta (descrição)" name="dieta" def={editingItem?.dieta} placeholder="Ex: 60% silagem + 40% concentrado" />
            <Input label="MS da Dieta (%)" name="msDieta" type="number" step="0.1" req def={editingItem?.msDieta || 60} />
            <Input label="Peso Alvo de Abate (kg)" name="pesoAlvoAbate" type="number" req def={editingItem?.pesoAlvoAbate || 560} />
            <Input label="GMD Alvo (kg/dia)" name="gmdAlvo" type="number" step="0.1" req def={editingItem?.gmdAlvo || 1.4} />
          </div>
        </Modal>
      )}

      {modalType === 'trato' && (
        <Modal title={editingItem ? 'Editar Trato' : 'Registrar Trato / Leitura de Cocho'} icon={UtensilsCrossed} formId="f_tra" onClose={closeModal} onSubmit={handleSaveForm}>
          <Select label="Lote de Confinamento" name="loteConfId" req def={editingItem?.loteConfId} options={[{ val: '', lbl: 'Selecione...' }, ...lotesConfAtivos.map(l => ({ val: l.id, lbl: `${l.nome} (${l.curralNome || 's/ curral'})` }))]} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Data" name="data" type="date" req def={editingItem?.data || today} />
            <Input label="Quantidade Fornecida (kg MN)" name="quantidadeKg" type="number" step="0.1" req def={editingItem?.quantidadeKg} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Custo Total do Trato (R$)" name="custoTotal" type="number" step="0.01" def={editingItem?.custoTotal} placeholder="Opcional" />
            <Input label="Sobra no Cocho (%)" name="sobraPct" type="number" step="0.5" def={editingItem?.sobraPct || 0} />
          </div>
          <p className="text-xs font-medium text-gray-400">Leitura de cocho ideal: sobra entre 0% e 5%. Acima disso, reduza o fornecimento.</p>
        </Modal>
      )}

      {modalType === 'saidaConf' && editingItem && (
        <Modal title={`Saída / Venda — ${editingItem.nome}`} icon={ArrowRightLeft} formId="f_sai" onClose={closeModal} onSubmit={handleSaveForm} submitText="Encerrar Lote">
          <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl mb-2">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">Resumo da entrada</p>
            <p className="text-sm font-bold text-gray-800 mt-1">{editingItem.qtdEntrada} cab • {editingItem.dataEntrada} • {fmtKg((Number(editingItem.pesoTotalEntrada) || 0) / (Number(editingItem.qtdEntrada) || 1), 0)} kg médio</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Data de Saída" name="dataSaida" type="date" req def={today} />
            <Input label="Nº Cabeças Vendidas" name="qtdSaida" type="number" req def={editingItem.qtdEntrada} />
            <Input label="Peso Total na Saída (kg)" name="pesoTotalSaida" type="number" step="0.1" req />
            <Input label="Valor Total da Venda (R$)" name="valorVendaTotal" type="number" step="0.01" placeholder="Opcional" />
          </div>
          <Input label="Observações" name="obsSaida" placeholder="Ex: destino, frigorífico, refugos..." />
        </Modal>
      )}

      {modalType === 'alimento' && (
        <Modal title={editingItem ? 'Editar Alimento' : 'Novo Alimento'} icon={Wheat} formId="f_ali" onClose={closeModal} onSubmit={handleSaveForm}>
          <Input label="Nome do Alimento" name="nome" req def={editingItem?.nome} placeholder="Ex: Silagem de Sorgo" />
          <div className="grid grid-cols-3 gap-4">
            <Input label="MS (%)" name="ms" type="number" step="0.1" req def={editingItem?.ms} />
            <Input label="PB (%)" name="pb" type="number" step="0.1" req def={editingItem?.pb} />
            <Input label="Preço (R$/kg)" name="precoKg" type="number" step="0.01" req def={editingItem?.precoKg} />
          </div>
        </Modal>
      )}

      {/* --- MODAL EXCLUSÃO SEGURA DE PROPRIEDADE (2 ETAPAS) --- */}
      {delProp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-r from-red-700 to-red-600 p-6 text-white">
              <h2 className="font-black text-lg flex items-center"><ShieldAlert size={20} className="mr-2" /> Excluir fazenda — etapa {delProp.etapa} de 2</h2>
              <p className="text-sm font-medium text-red-100 mt-1">{delProp.prop.nome} • {delProp.modo === 'expurgo' ? 'Expurgo definitivo (apaga todos os dados)' : 'Arquivamento (dados preservados)'}</p>
            </div>
            <div className="p-6 space-y-4">
              {delProp.etapa === 1 ? (
                <>
                  <p className="text-sm font-medium text-gray-600">Para confirmar, digite o nome exato da fazenda: <span className="font-black text-gray-900">{delProp.prop.nome}</span></p>
                  <input value={delProp.nomeDigitado} onChange={e => setDelProp({ ...delProp, nomeDigitado: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 font-bold" placeholder="Digite o nome da fazenda" />
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Destino dos dados</label>
                    <select value={delProp.modo} onChange={e => setDelProp({ ...delProp, modo: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold">
                      <option value="arquivamento">Arquivar (dados preservados, fazenda sai da lista)</option>
                      <option value="expurgo">Expurgo definitivo (apaga todos os dados vinculados)</option>
                    </select>
                  </div>
                </>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                  <p className="text-sm font-black text-red-800">Confirmação final</p>
                  <p className="text-sm font-medium text-red-700 mt-1">
                    {delProp.modo === 'expurgo'
                      ? 'Todos os animais, lotes, tratos, leituras de cocho, registros de água, sanidade e tarefas desta fazenda serão apagados permanentemente.'
                      : 'A fazenda será arquivada e removida do seletor. Os dados ficam preservados para auditoria.'}
                  </p>
                </div>
              )}
            </div>
            <div className="p-5 border-t bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setDelProp(null)} className="px-6 py-3 rounded-xl font-bold bg-white border border-gray-200 text-gray-700">Cancelar</button>
              {delProp.etapa === 1
                ? <button onClick={confirmarEtapa1} disabled={delProp.nomeDigitado !== delProp.prop.nome} className="px-8 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-40">Avançar</button>
                : <button onClick={confirmarEtapa2} className="px-8 py-3 rounded-xl font-bold text-white bg-red-700 hover:bg-red-600">Confirmar {delProp.modo === 'expurgo' ? 'Expurgo' : 'Arquivamento'}</button>}
            </div>
          </div>
        </div>
      )}

      {emailModalData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-8 text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6"><CheckCircle2 size={32} /></div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">Conta Criada!</h2><p className="text-gray-500 font-medium mb-6 text-sm">Envie o acesso para o operador.</p>
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-left mb-6 space-y-3"><p className="text-sm"><span className="font-bold text-gray-400 uppercase">Login:</span> <span className="font-bold text-indigo-600 block">{emailModalData.email}</span></p><p className="text-sm"><span className="font-bold text-gray-400 uppercase">Senha:</span> <code className="bg-white border border-gray-200 px-2 py-1 rounded-lg font-mono text-gray-900 block mt-1">{emailModalData.senha}</code></p></div>
            <div className="flex gap-3"><button onClick={() => setEmailModalData(null)} className="flex-1 px-6 py-3.5 rounded-xl font-bold bg-white border border-gray-200 text-gray-700">Fechar</button><button onClick={() => { window.location.href = `mailto:${emailModalData.email}?subject=${encodeURIComponent("Acesso - GestProp")}&body=${encodeURIComponent(`Login: ${emailModalData.email}\nSenha: ${emailModalData.senha}\nLink: ${window.location.origin}`)}`; setEmailModalData(null); }} className="flex-1 px-6 py-3.5 rounded-xl font-bold bg-indigo-600 text-white flex items-center justify-center"><Mail size={18} className="mr-2" /> Enviar Email</button></div>
          </div>
        </div>
      )}

    </div>
  );
}
