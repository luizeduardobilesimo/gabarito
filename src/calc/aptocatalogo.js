/* ================= Plantas de apartamento: catálogo de partidos (§3 de docs/APTOS.md) =================
   20 partidos de mercado (Brasil; os ~15 do §3 + compacto, de canto, lâmina rasa), no formato do §2 (o mesmo dos modelos do usuário): retângulos de eixo a eixo no
   referencial x ao longo da fachada × y da fachada (0) para o corredor (D). Medidas de referência de mercado:
   sala 3,0–4,8 m de frente; dormitório ≥ 2,5 m; suíte ≥ 2,7 m; banho 1,6–1,9 × 2,4–2,6 m; circulação íntima 1,10 m
   (0,98 m livres); faixa molhada 2,4–2,6 m junto do corredor (prumadas). Cada partido diz em que frente/profundidade
   funciona (faixaW/faixaD); os testes (tests/aptos.test.js) conferem nota ≥ 80 no desenho e nos extremos da faixa.
   Portas: só onde a dedução das regras não daria o desejado (aptoDeduzPortas). */
const APTO_CAT = (()=>{
  const a=(id,k,x,y,w,h,estica="xy",o={})=>({id, k, ret:[x,y,w,h], estica, ...o});
  const P=(id,nome,tipologia,W,D,fw,fd,ex,ambientes,extra={})=>({id:"cat-"+id, nome, origem:"catalogo", tipologia, W, D, faixaW:{min:fw[0],max:fw[1]}, faixaD:{min:fd[0],max:fd[1]}, entrada:{x:ex, lado:"corredor"}, ambientes, ...extra});
  return [
    P("studio-linear","Studio linear","studio",4.0,8.0,[3.6,4.8],[7.0,9.6],3.4,[
      a("a1","sala",0,0,4.0,5.6,"xy"), a("a2","banho",0,5.6,1.7,2.4,""), a("a3","cozinha",1.7,5.6,2.3,2.4,"x")]),
    P("studio-americana","Studio com cozinha americana","studio",6.0,6.2,[5.0,7.0],[5.4,7.0],3.6,[
      a("a1","sala",0,0,6.0,4.0,"xy"), a("a2","cozinha",0,4.0,4.2,2.2,"x"), a("a3","banho",4.2,4.0,1.8,2.2,"")]),
    P("1d-compacto","1 dorm. compacto","1d",6.0,6.4,[5.6,7.8],[6.2,7.4],1.2,[
      a("a1","sala",0,0,3.2,4.4,"xy"), a("a2","cozinha",0,4.4,3.2,2.0,"xy"), a("a3","dorm",3.2,0,2.8,3.3,"xy",{cama:"casal"}),
      a("a4","circ",3.2,3.3,1.25,1.1,""), a("a5","serv",3.2,4.4,1.25,2.0,"y"), a("a6","banho",4.45,3.3,1.55,3.1,"xy")]),
    P("1d-office","1 dorm. + home office","1d",8.0,6.6,[7.6,9.4],[6.2,7.6],1.6,[
      a("a1","sala",0,0,3.2,4.4,"xy"), a("a2","cozinha",0,4.4,3.2,2.2,"xy"), a("a3","office",3.2,0,2.0,3.3,"y"),
      a("a4","dorm",5.2,0,2.8,3.3,"xy",{cama:"casal"}), a("a5","circ",3.2,3.3,4.8,1.1,"x"), a("a6","serv",3.2,4.4,1.6,2.2,"y"),
      a("a7","banho",4.8,4.4,1.7,2.2,"y"), a("a8","desp",6.5,4.4,1.5,2.2,"xy")]),
    P("1s-varanda","1 suíte com varanda","1s",7.4,7.0,[7.0,9.4],[5.5,8.0],1.8,[
      a("a1","sala",0,0,3.7,4.6,"xy"), a("a2","cozinha",0,4.6,2.3,2.4,"xy"), a("a3","serv",2.3,4.6,1.4,2.4,"y"),
      a("a4","suite",3.7,0,3.7,4.2,"xy"), a("a5","closet",3.7,4.2,1.6,2.8,"y",{de:"a4"}), a("a6","bsuite",5.3,4.2,2.1,2.8,"xy",{de:"a4"})],
      {sacada:{lado:"fachada", prof:1.4, sobre:["a1","a4"]}}),
    P("2d-linear","2 dorm. linear (social na ponta)","2d",9.4,7.0,[8.6,11.8],[5.8,7.8],1.8,[
      a("a1","sala",0,0,3.6,7.0,"xy"), a("a2","dorm",3.6,0,2.9,3.3,"xy"), a("a3","dorm",6.5,0,2.9,3.3,"xy"),
      a("a4","circ",3.6,3.3,5.8,1.1,"x"), a("a5","cozinha",3.6,4.4,2.6,2.6,"xy"), a("a6","serv",6.2,4.4,1.5,2.6,"xy"),
      a("a7","banho",7.7,4.4,1.7,2.6,"y")]),
    P("2d-central","2 dorm. com social central","2d",9.4,7.0,[8.8,11.8],[6.1,7.8],4.7,[
      a("a1","dorm",0,0,2.8,3.4,"xy"), a("a2","sala",2.8,0,3.8,7.0,"xy"), a("a3","dorm",6.6,0,2.8,4.4,"xy"),
      a("a4","cozinha",0,3.4,2.8,2.4,"xy"), a("a5","serv",0,5.8,2.8,1.2,"x"), a("a6","circ",6.6,4.4,1.1,2.6,"y"),
      a("a7","banho",7.7,4.4,1.7,2.6,"xy")],
      {portas:[{a:"a2",b:"a1"},{a:"a2",b:"a3"},{a:"a2",b:"a4",tipo:"integ"},{a:"a4",b:"a5"},{a:"a2",b:"a6",tipo:"vao"},{a:"a6",b:"a7"}]}),
    P("2d-compacto","2 dorm. compacto","2d",7.9,7.0,[7.7,9.0],[6.4,8.0],1.5,[
      a("a1","sala",0,0,2.9,7.0,"xy"), a("a2","dorm",2.9,0,2.5,3.3,"xy"), a("a3","dorm",5.4,0,2.5,3.3,"xy"),
      a("a4","circ",2.9,3.3,5.0,1.1,"x"), a("a5","cozinha",2.9,4.4,2.0,2.6,"xy"), a("a6","serv",4.9,4.4,1.3,2.6,"y"),
      a("a7","banho",6.2,4.4,1.7,2.6,"xy")]),
    P("2d-canto","2 dorm. de canto (janela lateral)","2d",7.8,7.6,[7.0,8.6],[7.4,8.8],1.2,[
      a("a1","sala",0,0,3.4,4.8,"xy"), a("a2","cozinha",0,4.8,2.2,2.8,"xy"), a("a3","serv",2.2,4.8,1.2,2.8,"y"),
      a("a4","dorm",3.4,0,4.4,3.3,"xy",{cama:"casal"}), a("a5","circ",3.4,3.3,4.4,1.1,"x"), a("a6","banho",3.4,4.4,1.5,3.2,"y"),
      a("a7","dorm",4.9,4.4,2.9,3.2,"xy")],
      {lateral:{xW:true}}),
    P("2d-rasa","2 dorm. em lâmina rasa","2d",10.6,5.6,[9.6,12.4],[5.35,6.4],1.9,[
      a("a1","sala",0,0,3.8,5.6,"xy"), a("a2","dorm",3.8,0,3.3,2.8,"xy"), a("a3","dorm",7.1,0,3.5,2.8,"xy",{cama:"casal"}),
      a("a4","circ",3.8,2.8,6.8,1.05,"x"), a("a5","cozinha",3.8,3.85,2.8,1.75,"xy"), a("a6","serv",6.6,3.85,1.5,1.75,"y"),
      a("a7","banho",8.1,3.85,2.5,1.75,"xy")]),
    P("2d1s-ponta","2 dorm. com suíte · social na ponta","2d1s",10.0,7.0,[9.2,11.8],[6.0,7.8],1.4,[
      a("a1","sala",0,0,3.6,4.4,"xy"), a("a2","cozinha",0,4.4,2.4,2.6,"xy"), a("a3","serv",2.4,4.4,1.2,2.6,"y"),
      a("a4","dorm",3.6,0,2.8,3.3,"xy"), a("a5","circ",3.6,3.3,2.8,1.1,"x"), a("a6","banho",3.6,4.4,1.7,2.6,"y"),
      a("a7","desp",5.3,4.4,1.1,2.6,"xy"), a("a8","suite",6.4,0,3.6,4.4,"xy"), a("a9","bsuite",6.4,4.4,1.8,2.6,"y",{de:"a8"}),
      a("a10","closet",8.2,4.4,1.8,2.6,"xy",{de:"a8"})]),
    P("2d1s-integrada","2 dorm. com suíte · cozinha integrada","2d1s",10.4,7.0,[10.4,12.2],[6.4,7.8],1.7,[
      a("a1","sala",0,0,3.4,7.0,"xy"), a("a2","suite",3.4,0,2.9,3.3,"xy"), a("a3","bsuite",6.3,0,1.5,3.3,"y",{de:"a2"}),
      a("a4","dorm",7.8,0,2.6,3.3,"xy"), a("a5","circ",3.4,3.3,7.0,1.1,"x"), a("a6","cozinha",3.4,4.4,2.6,2.6,"xy"),
      a("a7","serv",6.0,4.4,1.4,2.6,"y"), a("a8","banho",7.4,4.4,1.8,2.6,"y"), a("a9","desp",9.2,4.4,1.2,2.6,"xy")]),
    P("2d1s-estreita","2 dorm. com suíte · frente estreita (profundo)","2d1s",8.2,9.0,[8.0,10.0],[8.2,10.0],4.0,[
      a("a1","sala",0,0,3.0,6.4,"xy"), a("a2","cozinha",0,6.4,3.0,2.6,"xy",{grupo:"gk"}), a("a3","cozinha",3.0,7.4,2.0,1.6,"x",{grupo:"gk"}),
      a("a4","dorm",3.0,0,2.5,4.0,"xy"), a("a5","circ",3.0,4.0,2.5,1.1,"x"), a("a6","suite",5.5,0,2.7,5.1,"xy"),
      a("a7","banho",3.0,5.1,2.5,2.3,"xy"), a("a8","bsuite",5.5,5.1,2.7,2.3,"xy",{de:"a6"}), a("a9","serv",5.0,7.4,1.6,1.6,"x"),
      a("a10","desp",6.6,7.4,1.6,1.6,"x")]),
    P("2s-lavabo","2 suítes + lavabo","2s",11.0,7.0,[10.2,12.8],[5.5,7.8],5.5,[
      a("a1","suite",0,0,3.1,4.4,"xy"), a("a2","bsuite",0,4.4,1.8,2.6,"xy",{de:"a1"}), a("a3","closet",1.8,4.4,1.3,2.6,"y",{de:"a1"}),
      a("a4","sala",3.1,0,4.8,4.4,"xy"), a("a5","serv",3.1,4.4,1.3,2.6,"y"), a("a6","cozinha",4.4,4.4,2.3,2.6,"xy"),
      a("a7","lavabo",6.7,4.4,1.2,2.6,"y"), a("a8","suite",7.9,0,3.1,4.4,"xy"), a("a9","closet",7.9,4.4,1.3,2.6,"y",{de:"a8"}),
      a("a10","bsuite",9.2,4.4,1.8,2.6,"xy",{de:"a8"})],
      {portas:[{a:"a4",b:"a1"},{a:"a4",b:"a8"},{a:"a1",b:"a2"},{a:"a1",b:"a3",tipo:"vao"},{a:"a8",b:"a9",tipo:"vao"},{a:"a8",b:"a10"},
               {a:"a4",b:"a6",tipo:"integ"},{a:"a6",b:"a5"},{a:"a4",b:"a7"}]}),
    P("3d1s-central","3 dorm. com suíte · social central","3d1s",12.4,7.0,[11.6,14.8],[6.4,7.8],7.4,[
      a("a1","dorm",0,0,2.7,3.3,"xy"), a("a2","dorm",2.7,0,2.7,3.3,"xy"), a("a3","circ",0,3.3,5.4,1.1,"x"),
      a("a4","banho",0,4.4,1.9,2.6,"xy"), a("a5","serv",1.9,4.4,1.4,2.6,"xy"), a("a6","cozinha",3.3,4.4,3.6,2.6,"xy"),
      a("a7","sala",5.4,0,3.8,4.4,"xy",{grupo:"gs"}), a("a8","sala",6.9,4.4,1.1,2.6,"y",{grupo:"gs"}), a("a9","sala",8.0,6.0,1.2,1.0,"y",{grupo:"gs"}),
      a("a10","lavabo",8.0,4.4,1.2,1.6,"y",{opc:"lavabo", funde:"a7"}),
      a("a11","suite",9.2,0,3.2,4.4,"xy"), a("a12","closet",9.2,4.4,1.5,2.6,"y",{de:"a11"}), a("a13","bsuite",10.7,4.4,1.7,2.6,"xy",{de:"a11"})],
      {portas:[{a:"entrada",b:"a7"},{a:"a7",b:"a3",tipo:"vao"},{a:"a3",b:"a1"},{a:"a3",b:"a2"},{a:"a3",b:"a4"},{a:"a7",b:"a6",tipo:"integ"},{a:"a6",b:"a5"},
               {a:"a7",b:"a10"},{a:"a7",b:"a11"},{a:"a11",b:"a12",tipo:"vao"},{a:"a11",b:"a13"}]}),
    P("3d1s-compacto","3 dorm. com suíte compacto","3d1s",11.0,7.0,[10.6,12.2],[6.4,7.8],1.5,[
      a("a1","sala",0,0,3.0,7.0,"xy"), a("a2","dorm",3.0,0,2.55,3.3,"xy"), a("a3","dorm",5.55,0,2.55,3.3,"xy"),
      a("a4","circ",3.0,3.3,5.1,1.1,"x"), a("a5","cozinha",3.0,4.4,2.1,2.6,"xy"), a("a6","serv",5.1,4.4,1.3,2.6,"y"),
      a("a7","banho",6.4,4.4,1.7,2.6,"xy"), a("a8","suite",8.1,0,2.9,4.4,"xy"), a("a9","bsuite",8.1,4.4,1.7,2.6,"y",{de:"a8"}),
      a("a10","closet",9.8,4.4,1.2,2.6,"xy",{de:"a8"})]),
    P("3d1s-rasa","3 dorm. com suíte em lâmina rasa","3d1s",14.0,5.6,[12.8,16.0],[5.35,6.4],2.1,[
      a("a1","sala",0,0,4.2,5.6,"xy"), a("a2","dorm",4.2,0,3.1,2.8,"xy"), a("a3","dorm",7.3,0,3.1,2.8,"xy"),
      a("a4","circ",4.2,2.8,6.2,1.05,"x"), a("a5","cozinha",4.2,3.85,2.8,1.75,"xy"), a("a6","serv",7.0,3.85,1.5,1.75,"y"),
      a("a7","banho",8.5,3.85,1.9,1.75,"xy"), a("a8","suite",10.4,0,3.6,3.85,"xy"), a("a9","bsuite",10.4,3.85,2.2,1.75,"xy",{de:"a8"}),
      a("a10","closet",12.6,3.85,1.4,1.75,"y",{de:"a8"})]),
    P("3d1s-larga","3 dorm. com suíte · frente larga (sala ampla)","3d1s",13.2,6.8,[12.2,15.8],[6.0,7.8],2.6,[
      a("a1","sala",0,0,4.4,5.2,"xy",{grupo:"gs"}), a("a1b","sala",1.3,5.2,3.1,1.6,"xy",{grupo:"gs"}), a("a2","lavabo",0,5.2,1.3,1.6,"y",{opc:"lavabo", funde:"a1"}),
      a("a3","dorm",4.4,0,2.7,3.3,"xy"), a("a4","dorm",7.1,0,2.7,3.3,"xy"), a("a5","circ",4.4,3.3,5.4,1.1,"x"),
      a("a6","cozinha",4.4,4.4,2.5,2.4,"xy"), a("a7","serv",6.9,4.4,1.3,2.4,"y"), a("a8","banho",8.2,4.4,1.6,2.4,"xy"),
      a("a9","suite",9.8,0,3.4,4.4,"xy"), a("a10","bsuite",9.8,4.4,1.7,2.4,"y",{de:"a9"}), a("a11","closet",11.5,4.4,1.7,2.4,"xy",{de:"a9"})]),
    P("3s-lavabo","3 suítes + lavabo (alto padrão)","3s",16.8,7.4,[15.6,19.0],[7.0,8.4],2.3,[
      a("a1","sala",0,0,4.6,7.4,"xy"), a("a2","cozinha",4.6,0,2.6,3.4,"xy"), a("a3","lavabo",4.6,3.4,1.4,2.8,"y"), a("a4","serv",6.0,3.4,1.2,2.8,"y"),
      a("a5","circ",4.6,6.2,12.2,1.2,"x",{grupo:"gc"}),
      a("a6","suite",7.2,0,3.2,3.6,"xy"), a("a7","bsuite",7.2,3.6,1.8,2.6,"y",{de:"a6"}), a("a8","circ",9.0,3.6,1.4,2.6,"xy",{grupo:"gc"}),
      a("a9","suite",10.4,0,3.2,3.6,"xy"), a("a11","circ",10.4,3.6,1.4,2.6,"xy",{grupo:"gc"}), a("a10","bsuite",11.8,3.6,1.8,2.6,"y",{de:"a9"}),
      a("a12","suite",13.6,0,3.2,3.6,"xy"), a("a13","bsuite",13.6,3.6,1.8,2.6,"y",{de:"a12"}), a("a14","circ",15.4,3.6,1.4,2.6,"xy",{grupo:"gc"})],
      {portas:[{a:"entrada",b:"a1"},{a:"a1",b:"a2",tipo:"integ"},{a:"a2",b:"a4"},{a:"a1",b:"a3"},{a:"a1",b:"a5",tipo:"vao"},
               {a:"a5",b:"a6"},{a:"a6",b:"a7"},{a:"a5",b:"a9"},{a:"a9",b:"a10"},{a:"a5",b:"a12"},{a:"a12",b:"a13"}]}),
    P("4d1s","4 dorm. com suíte (alto padrão)","4d1s",16.45,7.0,[15.4,19.0],[6.2,7.8],2.8,[
      a("a1","sala",0,0,4.6,5.4,"xy",{grupo:"gs"}), a("a1b","sala",1.3,5.4,3.3,1.6,"xy",{grupo:"gs"}), a("a2","lavabo",0,5.4,1.3,1.6,"y",{opc:"lavabo", funde:"a1"}),
      a("a3","dorm",4.6,0,2.75,3.3,"xy"), a("a4","dorm",7.35,0,2.75,3.3,"xy"), a("a5","dorm",10.1,0,2.75,3.3,"xy"),
      a("a6","circ",4.6,3.3,8.25,1.1,"x"), a("a7","cozinha",4.6,4.4,3.0,2.6,"xy"), a("a8","serv",7.6,4.4,1.45,2.6,"y"),
      a("a9","banho",9.05,4.4,1.9,2.6,"y"), a("a10","banho",10.95,4.4,1.9,2.6,"xy"),
      a("a11","suite",12.85,0,3.6,4.4,"xy"), a("a12","bsuite",12.85,4.4,1.9,2.6,"y",{de:"a11"}), a("a13","closet",14.75,4.4,1.7,2.6,"xy",{de:"a11"})])
  ];
})();
/* lista do catálogo (cópias), opcionalmente de uma tipologia */
function aptoCatalogo(tip){ return APTO_CAT.filter(m=>!tip || m.tipologia===tip).map(m=>JSON.parse(JSON.stringify(m))) }
/* modelo por id: catálogo ou os copiados para o estudo (S.comodos.modelos) */
function aptoModelo(id, st){ if(!id) return null; const c=APTO_CAT.find(m=>m.id===id); if(c) return c; const us=(st && st.comodos && st.comodos.modelos)||[]; return us.find(m=>m && m.id===id) || null }
