/* ================= marca do usuário no PDF (logo, cor, nome, rodapé, capa) =================
   Estado S.marca (extendDEF). A logo NÃO fica em S: vai para um localStorage separado ("gabarito.marca.logo"),
   já redimensionada, para não pesar no estudo salvo nem nos cenários. Sem marca ativa o PDF sai como sempre. */
extendDEF("marca", { ativa:false, nome:"", cor:"#1c6878", rodape:"", titulo:"", subtitulo:"", capa3d:true });

const MARCA_LS = "gabarito.marca.logo";
const MARCA_CORES = [["#1c6878","Petróleo"],["#1c2729","Grafite"],["#1f5f8b","Azul"],["#7a2e3b","Vinho"],["#2f6b4f","Verde"],["#a8782a","Dourado"]];
let _marcaLogo;   // undefined = ainda não lida · null = sem logo · {url,w,h,opaca}
function marcaLogo(){ if(_marcaLogo===undefined){ const l=LS.get(MARCA_LS); _marcaLogo = l && verLogoOk(l.url)? l : null } return _marcaLogo }
function marcaLogoTemp(l){ _marcaLogo = l && verLogoOk(l.url)? { url:l.url, w:+l.w||0, h:+l.h||0, opaca:!!l.opaca || /jpeg/.test(l.url.slice(0,16)) } : null }   // logo vinda de um link (não grava)
const marcaRGB = hex => { const h=verCorOk(hex)? hex : "#1c6878"; return [1,3,5].map(i=>parseInt(h.slice(i,i+2),16)) };
const marcaLum = c => (0.2126*c[0]+0.7152*c[1]+0.0722*c[2])/255;
const marcaOn = ()=> !!(S.marca && S.marca.ativa);

/* redimensiona uma imagem enviada (PNG, JPG, WebP, SVG) e guarda como PNG (com transparência) ou JPEG (opaca) */
function marcaRedimensionar(file, maxW, maxH, webp){
  return new Promise((ok,err)=>{
    const rd=new FileReader();
    rd.onerror=()=>err(new Error("não consegui ler o arquivo"));
    rd.onload=()=>{ const im=new Image();
      im.onerror=()=>err(new Error("imagem não reconhecida"));
      im.onload=()=>{
        const nw=im.naturalWidth||300, nh=im.naturalHeight||100, k=Math.min(1, maxW/nw, maxH/nh), w=Math.max(1,Math.round(nw*k)), h=Math.max(1,Math.round(nh*k));
        const cv=document.createElement("canvas"); cv.width=w; cv.height=h; const g=cv.getContext("2d"); g.imageSmoothingQuality="high"; g.drawImage(im,0,0,w,h);
        let opaca=true; try{ const d=g.getImageData(0,0,w,h).data; for(let i=3;i<d.length;i+=4*7){ if(d[i]<250){ opaca=false; break } } }catch(e){ opaca=false }
        let url=cv.toDataURL(opaca? "image/jpeg" : "image/png", 0.92); if(!verLogoOk(url)) url=cv.toDataURL("image/png");
        if(webp){ const wp=cv.toDataURL("image/webp",0.82); if(verLogoOk(wp) && wp.length<url.length) url=wp }
        ok({url,w,h,opaca}) };
      im.src=rd.result };
    rd.readAsDataURL(file);
  });
}
/* versão miúda da logo para dentro do link somente leitura (até VER_LOGO_MAX caracteres) */
let _logoMini=null;
async function marcaLogoMini(){
  const l=marcaLogo(); if(!l || !marcaOn()) return null;
  if(_logoMini && _logoMini.de===l.url) return _logoMini.v;
  let v=null;
  try{ for(const [mw,mh] of [[140,56],[110,44],[80,32]]){
    const b=await (await fetch(l.url)).blob(), f=new File([b],"logo"), r=await marcaRedimensionar(f,mw,mh,true);
    if(r.url.length<=VER_LOGO_MAX){ v=r; break } } }catch(e){}
  _logoMini={de:l.url,v}; return v;
}

/* ---------- PDF: usado por export.js ---------- */
function marcaPdf(){
  if(!marcaOn()) return null;
  const M=S.marca, cor=marcaRGB(M.cor), tint=cor.map(c=>Math.round(c+(255-c)*0.92));
  return { cor, tint, texto: marcaLum(cor)>0.62? [28,39,41] : [255,255,255], nome:String(M.nome||"").trim(), rodape:String(M.rodape||"").trim(),
    titulo:String(M.titulo||"").trim(), subtitulo:String(M.subtitulo||"").trim(), capa3d:M.capa3d!==false, logo:marcaLogo() };
}
const marcaFmt = url => /^data:image\/png/.test(url)? "PNG" : /^data:image\/webp/.test(url)? "WEBP" : "JPEG";
function marcaLogoPdf(doc, MK, x, y, maxW, maxH, fundoBranco){
  const l=MK.logo; if(!l || !l.w || !l.h) return 0;
  const k=Math.min(maxW/l.w, maxH/l.h), w=l.w*k, h=l.h*k;
  if(fundoBranco){ doc.setFillColor(255,255,255); doc.roundedRect(x-1.4,y-1.2,w+2.8,h+2.4,1.2,1.2,"F") }   // chip branco: a logo costuma não ter versão para fundo colorido
  try{ doc.addImage(l.url, marcaFmt(l.url), x, y, w, h) }catch(e){ return 0 }
  return w;
}
/* faixa do topo de cada página */
function marcaHead(doc, MK, titulo, PW, M, T){
  doc.setFillColor(...MK.cor); doc.rect(0,0,PW,16,"F"); doc.setTextColor(...MK.texto);
  let x=M; const w=marcaLogoPdf(doc, MK, M+1.4, 3.6, 36, 8.8, true); if(w) x+=w+6;
  if(MK.nome){ doc.setFont("helvetica","bold"); doc.setFontSize(12); doc.text(T(MK.nome).toUpperCase(), x, 10.5) }
  doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.text(T(titulo), PW-M, 10.5, {align:"right"});
}
/* texto da capa; devolve o novo y */
function marcaCapa(doc, MK, o){
  const {T,M,PW,ink,mut}=o; let y=o.y;
  const w=marcaLogoPdf(doc, MK, M, y, 60, 20, false); if(w) y+=26;
  doc.setFillColor(...MK.cor); doc.rect(M,y-2,14,1.4,"F"); y+=6;
  doc.setTextColor(...ink); doc.setFont("helvetica","bold"); doc.setFontSize(20);
  const tl=doc.splitTextToSize(T(MK.titulo||o.nome), PW-2*M); doc.text(tl, M, y+4); y+=tl.length*8.4+3;
  doc.setFont("helvetica","normal"); doc.setFontSize(10.5); doc.setTextColor(...mut);
  const sl=doc.splitTextToSize(T(MK.subtitulo||o.sub), PW-2*M); doc.text(sl, M, y); y+=sl.length*5+3; doc.setTextColor(...ink);
  return y;
}
/* rodapé de cada página (o número da página continua à direita) */
function marcaRodape(doc, MK, T, PW, M){
  if(!MK.rodape) return;
  doc.setDrawColor(...MK.cor); doc.setLineWidth(0.3); doc.line(M,289.4,PW-M,289.4);
  doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(93,106,106); doc.text(T(MK.rodape), M, 292.6, {maxWidth:PW-2*M-16});
}

/* ---------- card na etapa Cenários ---------- */
function marcaCardHTML(){
  const M=S.marca, l=marcaLogo(), on=!!M.ativa;
  const prev = on? `<div class="mk-prev" style="--mk:${verCorOk(M.cor)?M.cor:"#1c6878"};--mkt:${marcaLum(marcaRGB(M.cor))>0.62?"#1c2729":"#fff"}"><div class="mk-bar">${l?`<img src="${l.url}" alt="" class="${l.opaca?"op":""}">`:""}<b>${esc((M.nome||"").toUpperCase())}</b><span>Estudo de viabilidade</span></div>
    <div class="mk-cap"><i></i><b>${esc(M.titulo||S.nome)}</b><span>${esc(M.subtitulo||S.regras.cidade)}</span></div>${M.rodape?`<div class="mk-rod">${esc(M.rodape)}</div>`:""}</div>` : "";
  const campos = on? prev +
    TXT("marca.nome","Nome da empresa",{ph:"Ex.: Construtora Exemplo",fx:"marcaNome"}) +
    `<div class="fld wide"><span class="fl">Logo</span><div class="row" style="flex-wrap:nowrap;gap:8px"><label class="btn sm" for="mkLogoIn">${l?"Trocar logo":"Enviar logo"}</label><input type="file" id="mkLogoIn" accept="image/*" hidden>${l?`<button type="button" class="btn sm ghost" data-act="mkLogoDel">Remover</button><span class="note">${l.w}×${l.h} px</span>`:`<span class="note">PNG, JPG ou SVG</span>`}</div></div>` +
    `<div class="fld wide"><span class="fl">Cor principal</span><div class="mk-cores">${MARCA_CORES.map(([c,n])=>`<button type="button" class="mk-sw" data-set="marca.cor" data-v='"${c}"' data-fx="save" data-rr="1" style="--c:${c}" aria-pressed="${M.cor.toLowerCase()===c}" aria-label="${n}" title="${n}"></button>`).join("")}<label class="mk-sw mk-pick" title="Outra cor"><input type="color" data-p="marca.cor" data-t="s" data-fx="save" data-rr="1" value="${verCorOk(M.cor)?M.cor:"#1c6878"}" aria-label="Escolher outra cor"></label></div></div>` +
    TXT("marca.rodape","Rodapé das páginas",{ph:"Ex.: Construtora Exemplo · CRECI 0000 · (48) 0000-0000"}) +
    ADV(TXT("marca.titulo","Título",{ph:S.nome}) + TXT("marca.subtitulo","Subtítulo",{ph:S.regras.cidade}) + SW("marca.capa3d","Imagem 3D na capa",{fx:"save"}), {key:"marcaCapa", label:"Capa do relatório"})
    : "";
  const nome=String(M.nome||"").trim();
  return SEC("Marca no PDF", SW("marca.ativa","Usar a minha marca",{fx:"save",rr:true}) + campos,
    {key:"marca", id:"cardMarca", sum: on? (nome? "ligada · "+esc(nome) : "ligada") : "desligada",
     info:"Logo, cor, nome da empresa e rodapé no relatório PDF e na apresentação. Desligado, o relatório sai com a identidade do Gabarito. A logo fica só neste navegador."});
}
addCard("cen", { key:"marca", order:21, sub:"entregar", html:marcaCardHTML, after:()=>{
  const inp=document.getElementById("mkLogoIn"); if(!inp) return;
  inp.addEventListener("change",async()=>{ const f=inp.files&&inp.files[0]; if(!f) return;
    try{ const r=await marcaRedimensionar(f,480,240); _marcaLogo=r; _logoMini=null; LS.set(MARCA_LS,r); toast("Logo atualizada"); renderTab() }
    catch(e){ toast("Não consegui usar essa imagem") } });
} });
FX.marcaNome = ()=>{ save(); const n=String(S.marca.nome||"").trim(); setSum("marca", n? "ligada · "+esc(n) : "ligada") };
ACT.mkLogoDel =()=>{ _marcaLogo=null; _logoMini=null; LS.set(MARCA_LS,null); renderTab(); toast("Logo removida") };
