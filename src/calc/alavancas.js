/* ================= Fase D: Alavancas do negócio =================
   Cálculo puro (página, Worker e testes). Mexe numa coisa por vez e mostra quanto o resultado muda: lucro, margem s/ VGV (a margem
   principal, convenção da Fase A) e TIR. Nada é gravado em S; cada linha é um finance() sobre uma cópia rasa do estado/modelo.

   alavancasCalc(st, m) → { base:{lucro, margem, tir, vgv}, linhas:[{k, nome, passo, ok, motivo, desc, d:{lucro, margem, tir}, f?}], melhor }
     k        "efic" · "preco" · "terreno" · "obra" · "pav"
     d        diferenças em relação ao estudo (lucro em R$; margem e TIR em pontos de fração: 0,034 = +3,4 p.p.; tir null sem TIR)
     ok       false quando a alavanca não se aplica (sem terreno lançado, andar já no limite, o andar a mais não cabe…) — `motivo` diz por quê
     linhas   ordenadas: as que se aplicam, pelo maior ganho de lucro; depois as que não se aplicam

   O que é cada uma (passos em S.alavancas, todos editáveis):
   - efic    +5% de EFICIÊNCIA DO ANDAR (S.produto.efic, relativa: 80% → 84%). A mesma planta, a mesma área construída e o mesmo custo,
             mas cada andar entrega 5% mais área privativa (paredes e circulação mais enxutas): as unidades crescem 5% ao mesmo preço por m².
             (No modelo isso equivale a subir `efic` e as áreas do mix na mesma proporção: a planta do andar não muda.) Limite: 95%.
   - preco   +5% no preço de tabela (todas as tipologias, coberturas e lojas); o custo não muda, corretagem/marketing/RET acompanham o VGV.
   - terreno −10% no preço do terreno, na permuta física e na financeira (o ITBI acompanha).
   - obra    −5% no custo de obra (CUB, lazer e movimento de terra); projetos, administração e contingência acompanham.
   - pav     +1 pavimento tipo em cada torre. Estimado pela massa (massing, sem o layout da garagem), comparando o estudo e a variante pelo
             mesmo caminho; só vale se couber no gabarito (m.hLim), no CA e no mix. */
extendDEF("alavancas", { efic: 0.05, preco: 0.05, terreno: 0.10, obra: 0.05, pav: 1 });

const ALAV_EFIC_MAX = 0.95;
const alavMi2 = (a, b) => `${nf(a / 1e6, 1)} → ${nf(b / 1e6, 1)} mi`;   // 13,9 → 12,5 mi
const alavP = (p) => nf(p * 100, Math.abs(p * 100 - Math.round(p * 100)) < 1e-9 ? 0 : 1);

function alavancasCalc(st, m) {
  const A = Object.assign({}, DEF.alavancas, st.alavancas || {}), F = st.fin, P = st.produto, R = st.regras;
  const base = finance(st, m, { noHooks: true });
  const dif = (f, b) => ({ lucro: f.lucro - b.lucro, margem: f.margemVGV - b.margemVGV, tir: (f.tirA != null && b.tirA != null) ? f.tirA - b.tirA : null });
  const linhas = [];
  const lin = (k, nome, passo, f, b, extra) => linhas.push(Object.assign({ k, nome, passo, ok: true, d: dif(f, b), f }, extra));
  const nao = (k, nome, passo, motivo, extra) => linhas.push(Object.assign({ k, nome, passo, ok: false, motivo, d: { lucro: 0, margem: 0, tir: null } }, extra));

  // eficiência do andar: a planta é a mesma, cada andar vende `fac` vezes mais área privativa (unidades maiores ao mesmo preço por m²)
  { const p = +A.efic || 0, nome = `+${alavP(p)}% eficiência`, fac = Math.min(1 + p, ALAV_EFIC_MAX / Math.max(0.01, P.efic));
    if (!(p > 0)) nao("efic", nome, p, "passo zerado");
    else if (fac <= 1 + 1e-9) nao("efic", nome, p, `eficiência do andar já em ${pct(P.efic, 0)}, perto do limite de ${pct(ALAV_EFIC_MAX, 0)}`);
    else {
      const mv = Object.assign({}, m, { unitRows: (m.unitRows || []).map(u => Object.assign({}, u, { area: u.area * fac })), vgvUnidades: m.vgvUnidades != null ? m.vgvUnidades * fac : m.vgvUnidades });
      const f = finance(st, mv, { noHooks: true });
      lin("efic", nome, p, f, base, { desc: `${pct(P.efic, 0)} → ${pct(P.efic * fac, 0)} no andar` });
    }
  }
  // preço
  { const p = +A.preco || 0, nome = `+${alavP(p)}% preço`;
    if (!(p > 0)) nao("preco", nome, p, "passo zerado");
    else { const f = finance(st, m, { noHooks: true, dp: p }); lin("preco", nome, p, f, base, { desc: `VGV ${f.vgv >= base.vgv ? "+" : "−"}${mi(Math.abs(f.vgv - base.vgv))}` }) }
  }
  // terreno (preço à vista + permuta física + permuta financeira)
  { const p = +A.terreno || 0, nome = `−${alavP(p)}% terreno`;
    if (!(p > 0)) nao("terreno", nome, p, "passo zerado");
    else if (!(F.terreno > 0 || F.permuta > 0 || F.permutaFin > 0)) nao("terreno", nome, p, "sem terreno lançado nas premissas");
    else {
      const st2 = Object.assign({}, st, { fin: Object.assign({}, F, { terreno: F.terreno * (1 - p), permuta: F.permuta * (1 - p), permutaFin: F.permutaFin * (1 - p) }) });
      const f = finance(st2, m, { noHooks: true });
      lin("terreno", nome, p, f, base, { desc: `${alavMi2(base.terreno + base.permV, f.terreno + f.permV)} de terreno` });
    }
  }
  // obra
  { const p = +A.obra || 0, nome = `−${alavP(p)}% obra`;
    if (!(p > 0)) nao("obra", nome, p, "passo zerado");
    else { const f = finance(st, m, { noHooks: true, dc: -p }); lin("obra", nome, p, f, base, { desc: `${alavMi2(base.obra, f.obra)} de obra` }) }
  }
  // +N pavimentos em cada torre (estimativa pela massa; base e variante pelo mesmo caminho)
  { const n = Math.max(1, Math.round(+A.pav || 1)), nome = `+${n} pavimento${n > 1 ? "s" : ""}`;
    const stB = Object.assign({}, st), mB = massing(stB);
    const st2 = Object.assign({}, st, { produto: Object.assign({}, P, { torres: P.torres.map(t => Object.assign({}, t, { pav: (+t.pav || 0) + n })) }) });
    const m2 = massing(st2), hLim = m2.hLim != null ? m2.hLim : R.hMax;
    if (!mB.T.every(t => t.fit)) nao("pav", nome, n, "o mix já não cabe no andar");
    else if (m2.H > hLim + 1e-6) nao("pav", nome, n, `passa do gabarito de ${nf(hLim, 0)} m`);
    else if (m2.CA > R.caMax + 1e-6) nao("pav", nome, n, `passa do CA de ${nf(R.caMax, 1)}`);
    else if (!m2.T.every(t => t.fit)) nao("pav", nome, n, "o mix não cabe no andar");
    else {
      const fB = finance(stB, mB, { noHooks: true }), f = finance(st2, m2, { noHooks: true });
      lin("pav", nome, n, f, fB, { desc: `+${m2.units - mB.units} un · exige +${Math.max(0, m2.vagasReq - mB.vagasReq)} vagas` });
    }
  }
  const ordem = (a, b) => (b.ok - a.ok) || (a.ok ? b.d.lucro - a.d.lucro : 0);
  linhas.sort(ordem);
  return { base: { lucro: base.lucro, margem: base.margemVGV, tir: base.tirA, vgv: base.vgv }, linhas, melhor: linhas.length && linhas[0].ok ? linhas[0] : null };
}
