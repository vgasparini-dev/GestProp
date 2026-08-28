// src/lib/zoo.js — Métricas zootécnicas do confinamento (Pecuária de Precisão)
// Todas as funções são puras: fáceis de testar e espelham o Worker.

export const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Dias entre datas ISO (mínimo 1; datas inválidas → 1). */
export const diasEntre = (de, ate) => {
  const t1 = new Date(de).getTime(), t2 = new Date(ate).getTime();
  if (!Number.isFinite(t1) || !Number.isFinite(t2)) return 1;
  return Math.max(1, Math.round((t2 - t1) / 86400000));
};

/**
 * Métricas completas de um lote de confinamento.
 * @param lote   registro do lote (entrada/saída, dieta, alvos)
 * @param tratos lista de tratos do lote [{quantidadeKg, custoTotal}]
 * @param pesoAtualMedio  peso médio atual (kg) ou null
 */
export function metricasLote(lote, tratos = [], pesoAtualMedio = null) {
  const kgMN = tratos.reduce((a, t) => a + num(t.quantidadeKg), 0);
  const custoTratos = tratos.reduce((a, t) => a + num(t.custoTotal), 0);
  const qtd = num(lote.qtdEntrada) || num(lote.qtd_entrada);
  const pesoEntMed = qtd > 0 ? num(lote.pesoTotalEntrada ?? lote.peso_total_entrada) / qtd : 0;
  const encerrado = (lote.status === 'Encerrado');
  const fim = encerrado && (lote.dataSaida || lote.data_saida) ? (lote.dataSaida || lote.data_saida) : new Date().toISOString().slice(0, 10);
  const dias = diasEntre(lote.dataEntrada || lote.data_entrada, fim);

  let pesoAtual = pesoAtualMedio;
  if (encerrado && num(lote.pesoTotalSaida ?? lote.peso_total_saida) > 0 && num(lote.qtdSaida ?? lote.qtd_saida) > 0)
    pesoAtual = num(lote.pesoTotalSaida ?? lote.peso_total_saida) / num(lote.qtdSaida ?? lote.qtd_saida);

  const gmd = pesoAtual != null && pesoEntMed > 0 ? (pesoAtual - pesoEntMed) / dias : null;
  const qtdRef = encerrado ? (num(lote.qtdSaida ?? lote.qtd_saida) || qtd) : qtd;
  const ganhoTotal = pesoAtual != null ? Math.max(0, (pesoAtual - pesoEntMed) * qtdRef) : null;
  const msPct = num(lote.msDieta ?? lote.ms_dieta ?? 60) / 100;
  const kgMS = kgMN * msPct;
  // Rendimento de carcaça do lote (camelCase / snake_case / variante ES); padrão 52%
  const rendimento = num(lote.rendimentoCarcaca ?? lote.rendimento_carcaca ?? lote.rendimento_carcasa ?? 52) || 52;

  return {
    dias, kgMN, kgMS, custoTratos, pesoEntMed, pesoAtual, gmd, ganhoTotal, encerrado, qtd,
    // Conversão alimentar: kg MS consumida / kg de ganho
    conversaoAlimentar: ganhoTotal > 0 && kgMS > 0 ? kgMS / ganhoTotal : null,
    // Eficiência alimentar: kg ganho / kg MS (inverso da CA)
    eficienciaAlimentar: ganhoTotal != null && kgMS > 0 ? ganhoTotal / kgMS : null,
    // Consumo de MS por cabeça/dia
    cmsCabDia: qtd > 0 && dias > 0 ? kgMS / dias / qtd : null,
    // Custo da arroba produzida: custo / ((ganho kg × rendimento%) / 15 kg/@)
    custoArroba: ganhoTotal > 0 ? custoTratos / ((ganhoTotal * rendimento / 100) / 15) : null,
    // Estimativa de carcaça (rendimento padrão 52%, editável no lote)
    carcacaEstimadaKg: pesoAtual != null ? pesoAtual * rendimento / 100 : null,
    arrobasEstimadas: pesoAtual != null ? (pesoAtual * rendimento / 100) / 15 : null,
    // Projeção de saída ao GMD observado
    diasRestantes: gmd > 0 && !encerrado ? Math.max(0, Math.round((num(lote.pesoAlvoAbate ?? lote.peso_alvo_abate ?? 560) - pesoAtual) / gmd)) : null,
    lucro: encerrado ? num(lote.valorVendaTotal ?? lote.valor_venda_total) - num(lote.custoCompraTotal ?? lote.custo_compra_total) - custoTratos : null,
  };
}

/** GMD individual a partir do histórico de pesagens de um brinco. */
export function gmdIndividual(pesagens) {
  const p = [...pesagens].sort((a, b) => new Date(b.data) - new Date(a.data));
  if (p.length < 2) return null;
  const dias = diasEntre(p[1].data, p[0].data);
  const atual = num(p[0].pesoAtual ?? p[0].peso), anterior = num(p[1].pesoAtual ?? p[1].peso);
  return dias > 0 ? (atual - anterior) / dias : null;
}

/** Escala de cocho 0–4: metadados para UI e regras. */
export const ESCALA_COCHO = [
  { nota: 0, rotulo: 'Cocho rapado', cor: 'text-blue-700 bg-blue-100', ajuste: +7.5, desc: 'Sobra zero antes do trato — aumentar oferta' },
  { nota: 1, rotulo: 'Sobra limpa', cor: 'text-cyan-700 bg-cyan-100', ajuste: +5, desc: 'Rastro de ração — ajuste fino para cima' },
  { nota: 2, rotulo: 'Ideal (2–5%)', cor: 'text-green-700 bg-green-100', ajuste: 0, desc: 'Sobra pontilhada — manter fornecimento' },
  { nota: 3, rotulo: 'Sobra 5–10%', cor: 'text-amber-700 bg-amber-100', ajuste: -5, desc: 'Reduzir oferta no próximo trato' },
  { nota: 4, rotulo: 'Sobra excessiva', cor: 'text-red-700 bg-red-100', ajuste: -10, desc: '>10% de sobra — reduzir forte e investigar' },
];

/** Ajuste de trato recomendado (espelha a regra do Worker). */
export function ajustePorCocho(nota, historico = []) {
  const base = ESCALA_COCHO[Math.round(Math.min(4, Math.max(0, nota)))]?.ajuste ?? 0;
  const ult = historico.slice(-3).map((h) => num(h.nota));
  let ajuste = base;
  if (ult.length === 3 && ult.every((n) => n <= 1)) ajuste += 2.5;
  if (ult.length === 3 && ult.every((n) => n >= 3)) ajuste -= 2.5;
  return ajuste;
}

/** Indicadores sanitários de um conjunto de lotes. */
export function indicadoresSanidade({ lotes = [], tratamentos = [], obitos = [] }) {
  const cabecas = lotes.reduce((a, l) => a + (num(l.qtdEntrada ?? l.qtd_entrada)), 0) || 1;
  const custoMed = tratamentos.reduce((a, t) => a + num(t.custoTotal ?? t.custo_total), 0);
  const porCausa = obitos.reduce((acc, o) => {
    const c = o.causaMortis || o.causa_mortis || 'Não informada';
    acc[c] = (acc[c] || 0) + 1; return acc;
  }, {});
  const cabecasTratadas = tratamentos.reduce((a, t) => a + (num(t.qtdAnimais ?? t.qtd_animais) || 1), 0);
  return {
    cabecasBase: cabecas,
    // Morbidade: soma das cabeças tratadas (qtdAnimais de cada tratamento) / base
    morbidadePct: (cabecasTratadas / cabecas) * 100,
    mortalidadePct: (obitos.length / cabecas) * 100,
    mortalidadePorCausa: porCausa,
    custoMedicamentoCabeca: custoMed / cabecas,
  };
}
