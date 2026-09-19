'use strict';
/* Neón y Ceniza: motor del director de juego.
   Se ejecuta en GitHub Actions cada vez que alguien abre una incidencia (issue) con un título como
   "[unirse]", "[accion]", "[comenzar]", "[cerrar]" o "[reiniciar]".
   - El estado público va en estado.json.
   - El estado secreto va en secreto.json, cifrado con la llave del director.
   - Lo privado de cada jugador viaja cifrado con la llave pública de ese jugador. */
const fs=require('fs'),path=require('path'),nodeCrypto=require('node:crypto');
const NC=require('../datos.js'),Cripto=require('../cripto.js');
const {REC,RKEYS,ATR,ATR_ORDEN,CASAS,POD,ORIGENES,ROLES,SOC,OBJ,INT,GIROS,SEMILLAS,POSTURAS,posturaPoder,podsDe,A,bonoRolDe,calcRec,validaPersonaje,clamp}=NC;

const RAIZ=path.join(__dirname,'..'),env=process.env;
const leer=(f,def)=>{try{return JSON.parse(fs.readFileSync(path.join(RAIZ,f),'utf8'));}catch(e){return def;}};
const escribir=(f,o,ind)=>fs.writeFileSync(path.join(RAIZ,f),JSON.stringify(o,null,ind||0)+'\n');
const clon=x=>JSON.parse(JSON.stringify(x));
const cut=(s,n)=>String(s==null?'':s).slice(0,n);
const d6=()=>nodeCrypto.randomInt(1,7);
class UErr extends Error{}
const usr=m=>new UErr(m);
const MAX_JUG=6;

let cfg,P,S,priv,autor,titulo,cuerpo;

/* ---------- estado inicial ---------- */
function estadoInicial(){
  return {v:1,estado:'lobby',nombre:cfg.nombre||'La Sucesión',dur:cfg.dur||7,dia:0,host:String(env.REPO_OWNER||'').toLowerCase(),jugadores:{},dias:{},epilogo:'',actualizado:''};
}
function secretoInicial(){return {verdad:'',hechos:[],resumen:'',dias:{},jug:{},acc:{}};}
function parseCuerpo(){
  const i=cuerpo.indexOf('{'),j=cuerpo.lastIndexOf('}');
  if(i<0||j<=i)throw usr('No pude leer los datos de la incidencia. Usa el botón del juego para enviarla, sin modificar el texto.');
  try{return JSON.parse(cuerpo.slice(i,j+1));}catch(e){throw usr('Los datos de la incidencia están dañados. Vuelve a enviarla desde el juego.');}
}
const esHost=()=>autor.toLowerCase()===String(P.host||env.REPO_OWNER||'').toLowerCase();

/* ---------- utilidades de estado ---------- */
const diaPublico=d=>({n:d.n,titulo:d.titulo,escena:d.escena,opciones:d.opciones,
  npc:d.npc?{nombre:d.npc.nombre,titulo:d.npc.titulo,descripcion:d.npc.descripcion}:null,
  amenaza:d.amenaza?{nombre:d.amenaza.nombre,descripcion:d.amenaza.descripcion}:null,res:null});
function pjDe(l){const j=P.jugadores[l];return {nombre:j.nombre,casa:j.casa,origen:j.origen,rol:j.rol,attrs:j.attrs};}
async function actualizarBlob(l){
  const j=P.jugadores[l],s=S.jug[l],hoy=(S.acc[P.dia]||{})[l];
  const h=hoy?{dia:P.dia,tipo:hoy.tipo,desc:hoy.desc,attr:hoy.attr,dif:hoy.dif,dado:hoy.dado,base:hoy.base,bono:hoy.bono,poder:hoy.poder,total:hoy.total,exito:hoy.exito,combate:hoy.combate||null}:null;
  j.blob=await Cripto.cifrar(j.pub,{rec:s.rec,xp:s.xp,soc:s.soc,obj:s.obj,priv:s.priv.slice(-12),hoy:h,t:new Date().toISOString()});
  j.inf=s.rec.inf;
}

/* ---------- Claude por API ---------- */
async function claudeJSON(prompt){
  const url=(env.ANTHROPIC_API_URL||'https://api.anthropic.com')+'/v1/messages';
  if(!env.ANTHROPIC_API_KEY)throw usr('Falta el secreto ANTHROPIC_API_KEY en el repositorio.');
  let ultimo='';
  for(let intento=0;intento<3;intento++){
    let r;
    try{
      r=await fetch(url,{method:'POST',headers:{'content-type':'application/json','x-api-key':env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},
        body:JSON.stringify({model:env.MODELO||'claude-sonnet-5',max_tokens:4096,messages:[{role:'user',content:prompt}]})});
    }catch(e){ultimo='red: '+e.message;continue;}
    if(!r.ok){ultimo='HTTP '+r.status+' '+(await r.text()).slice(0,300);if(r.status===401||r.status===403||r.status===400)break;continue;}
    const j=await r.json();
    const t=(j.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('');
    try{return JSON.parse(t);}catch(e){}
    const a=t.indexOf('{'),b=t.lastIndexOf('}');
    if(a>=0&&b>a){try{return JSON.parse(t.slice(a,b+1));}catch(e){}}
    ultimo='respuesta sin JSON válido';
  }
  console.error('Fallo al llamar a Claude:',ultimo);
  throw usr('El Director de juego no pudo responder ('+ultimo.slice(0,120)+'). La partida sigue como estaba: el anfitrión puede reintentarlo desde la página (Comenzar la campaña o Cerrar el día).');
}

/* ---------- prompts del director ---------- */
function mundoTxt(){
  return 'Eres el Director de juego (Game Master) de «Neón y Ceniza», un juego de rol de intriga política en la Arcópolis de Aldric: una megaciudad ciberpunk con toques medievales (torres-fortaleza, heráldica holográfica, caballeros con espadas monofilamento, bancos que funcionan como monasterios) donde existen ángeles, demonios, dioses dormidos en los servidores del Panteón, poderes mentales, sociedades secretas (masonería, cultos, hackers telépatas), litigios políticos, negocios, poder y traición. Hay tensión sensual e insinuación cuando corresponde, nunca contenido explícito. '+
  'Premisa: el Soberano Aldric murió a las 04:12 en la Torre Alta, sin heredero, con la ventana abierta a 300 pisos del suelo y la copa intacta; su Llave (el sello criptográfico que valida cada voto) desapareció. Las Siete Casas eligen sucesor en el Cónclave en '+P.dur+' días.\n'+
  'Estilo: narras en español, con prosa breve, sensorial y tensa. Eres justo pero impredecible. Sorprende con giros, revelaciones y traiciones que nazcan de lo que hicieron los jugadores; evita lo obvio y no repitas estructuras de días anteriores; no todos los éxitos son buenos ni todos los fallos son malos. Las alianzas, seducciones y traiciones entre jugadores tienen consecuencias reales para ambos. Protege los secretos: la crónica pública nunca revela objetivos secretos, sociedades secretas ni resultados privados; eso va solo en el campo privado de cada jugador. Ningún jugador muere ni queda fuera de la partida.';
}
function ctxJugadores(){
  return Object.keys(P.jugadores).map(l=>{
    const j=P.jugadores[l],s=S.jug[l];
    return '- id:'+l+' | '+j.nombre+' | Casa '+CASAS[j.casa].n+' ('+CASAS[j.casa].gremio+') | '+ROLES[j.rol].n+' | origen: '+ORIGENES[j.origen].n+' | sociedad secreta: '+SOC[s.soc].n+' | objetivo secreto: '+OBJ[s.obj].txt+' | recursos: '+RKEYS.map(k=>REC[k]+' '+s.rec[k]).join(', ');
  }).join('\n');
}
function ctxAcciones(n){
  const d=S.dias[n]||{},acc=S.acc[n]||{};
  return Object.keys(P.jugadores).map(l=>{
    const j=P.jugadores[l],a=acc[l];
    if(!a)return '- '+j.nombre+' (id:'+l+'): no eligió acción hoy.';
    const o=a.obj&&P.jugadores[a.obj];
    const inter=o?' Además intenta «'+INT[a.int]+'» con '+o.nombre+' (id:'+a.obj+').':'';
    if(a.tipo==='amenaza')return '- '+j.nombre+' (id:'+l+'): enfrentó a «'+d.amenaza.nombre+'». Resultado del combate: '+a.combate.fin+'. Registro: '+a.combate.log.join(' | ')+inter;
    const tir='Tirada de '+ATR[a.attr].n+': dado '+a.dado+' + '+a.base+(a.bono?' + 1 cargo':'')+(a.poder?' + 2 poder «'+POD[a.poder].n+'»':'')+' = '+a.total+' contra dificultad '+a.dif+' ('+(a.exito?'ÉXITO':'FALLO')+(a.dado===6?', crítico':(a.dado===1?', pifia':''))+').';
    if(a.tipo==='npc')return '- '+j.nombre+' (id:'+l+'): habló con '+d.npc.nombre+' ('+d.npc.titulo+'; quiere: '+d.npc.quiere+'; secreto o miedo: '+d.npc.oculto+'; estilo: '+d.npc.estilo+'). Le dijo o propuso: «'+a.texto+'». '+tir+' Interpreta la reacción del personaje y EVALÚA la negociación de este jugador (campos puntaje, leccion y mision).'+inter;
    return '- '+j.nombre+' (id:'+l+'): '+a.desc+'. '+tir+inter;
  }).join('\n');
}
const ESQ_SIG='"siguiente":{"titulo":"título corto del día","escena":"situación del día en 90 a 130 palabras: plantea un dilema concreto y un giro que nace de lo ocurrido","opciones":[{"t":"acción concreta de 8 a 14 palabras","attr":"una de fue|des|com|sab|psi|ast|elo|enc|man","dif":6,"riesgo":"consecuencia posible en pocas palabras"}],"npc":{"nombre":"nombre","titulo":"cargo o descripción breve","descripcion":"aspecto y actitud en una frase","quiere":"lo que busca de verdad","oculto":"un secreto o miedo que solo revela si ganan su confianza","estilo":"cómo habla"},"amenaza":{"nombre":"nombre","descripcion":"una frase","vigor":6,"ataque":4}}';
const NOTA_SIG='Para "siguiente": 4 o 5 opciones con atributos distintos y dificultad entre 5 y 9. "npc" en la mayoría de los días y "amenaza" en algunos (usa null cuando no aplique). Todo el texto en una sola línea por campo; usa \\n solo para separar párrafos.';
function promptGM(tipo){
  const giro=GIROS[Math.floor(Math.random()*GIROS.length)],sem=SEMILLAS[Math.floor(Math.random()*SEMILLAS.length)];
  let p=mundoTxt()+'\n\nJugadores:\n'+ctxJugadores()+'\n\n';
  if(tipo==='inicio'){
    return p+'Tu tarea: crear el misterio de la campaña y abrir el día 1. Inspiración para el tono (no la copies literal): «'+sem+'». Giro sugerido para más adelante: '+giro+'.\n'+
      'Responde SOLO con un JSON con esta forma exacta:\n{"verdad":"lo que realmente pasó la noche de la muerte y dónde está la Llave, con al menos dos culpables o intereses en conflicto, máx 400 caracteres","hechos":["3 a 5 hechos públicos del mundo al comenzar"],"resumen":"resumen inicial de la situación, máx 500 caracteres",'+ESQ_SIG+'}\n'+NOTA_SIG;
  }
  const n=P.dia,d=S.dias[n],fin=n>=P.dur;
  p+='Verdad oculta (solo tú la conoces): '+(S.verdad||'aún por definir')+'\n'+
    'Hechos establecidos:\n'+((S.hechos||[]).map(h=>'- '+h).join('\n')||'- ninguno')+'\n'+
    'Resumen hasta ahora: '+(S.resumen||'sin resumen')+'\n\n'+
    'Hoy es el día '+n+' de '+P.dur+'. Situación de hoy: «'+d.titulo+'». '+d.escena+'\n\nAcciones de los jugadores:\n'+ctxAcciones(n)+'\n\n'+
    'Tu tarea: resolver el día. Usa los resultados de las tiradas como guía, pero interpreta con criterio. Decide qué le pasa a cada jugador y cómo interactúan entre sí. Cambios de recursos: enteros pequeños (normalmente entre -2 y +2; Éter y Vigor entre -3 y +2), coherentes con lo ocurrido. Claves de recursos: cre, inf, sec, lea, eter, vig. '+
    (fin?'Este es el ÚLTIMO día: cierra la historia con un epílogo público y consecuente con los objetivos y con lo que hicieron. No incluyas "siguiente".\n':'Después abre el día '+(n+1)+' con una situación nueva que nazca de lo ocurrido. Giro sugerido (úsalo solo si encaja): '+giro+'. Inspiración de tono: «'+sem+'».\n')+
    'Responde SOLO con un JSON con esta forma exacta:\n{"cronica":"lo que pasó hoy, narración pública en 2 a 4 párrafos cortos (máx 200 palabras), sin revelar secretos individuales","jugadores":{"<id del jugador>":{"resultado":"lo que le pasó a este jugador, 2 a 3 frases (máx 60 palabras)","secreto":"algo que solo este jugador descubre o siente (puede ir vacío)","cambios":{"cre":0,"inf":0,"sec":0,"lea":0,"eter":0,"vig":0},"xp":10,"puntaje":"solo si habló con el personaje: entero de 0 a 100 según preguntas abiertas, escucha, concesiones a cambio de algo y cierre claro","leccion":"solo si habló con el personaje: cómo aplicar lo aprendido a la vida real, 2 frases","mision":"solo si habló con el personaje: una acción concreta para practicar hoy, máx 20 palabras"}},"hechos":["hasta 4 hechos nuevos ya establecidos, una frase cada uno"],"verdad":"la verdad oculta actualizada si cambió, máx 400 caracteres","resumen":"resumen acumulado actualizado, máx 900 caracteres"'+
    (fin?',"epilogo":"epílogo público en 3 párrafos cortos (máx 250 palabras)"':','+ESQ_SIG)+'}\n'+
    (fin?'Incluye una entrada por cada jugador en "jugadores".':NOTA_SIG+' Incluye una entrada por cada jugador en "jugadores".');
  return p;
}

/* ---------- normalización de lo que devuelve Claude ---------- */
function normNpc(x){
  if(!x||typeof x!=='object'||!x.nombre)return null;
  return {nombre:cut(x.nombre,60),titulo:cut(x.titulo||'personaje de la corte',100),descripcion:cut(x.descripcion||'',220),quiere:cut(x.quiere||'',220),oculto:cut(x.oculto||'',220),estilo:cut(x.estilo||'habla con cautela',140)};
}
function normAmenaza(x){
  if(!x||typeof x!=='object'||!x.nombre)return null;
  return {nombre:cut(x.nombre,60),descripcion:cut(x.descripcion||'',220),vigor:clamp(Math.round(Number(x.vigor))||6,4,9),ataque:clamp(Math.round(Number(x.ataque))||4,3,5)};
}
function normDia(n,s){
  s=s||{};
  const ops=(Array.isArray(s.opciones)?s.opciones:[]).slice(0,5).filter(o=>o&&o.t).map(o=>({t:cut(o.t,160),attr:ATR[o.attr]?o.attr:'ast',dif:clamp(Math.round(Number(o.dif))||7,5,9),riesgo:cut(o.riesgo||'',120)}));
  const rel=[{t:'Investigar con discreción',attr:'sab',dif:7,riesgo:''},{t:'Hablar con las Casas y tantear alianzas',attr:'elo',dif:7,riesgo:''},{t:'Mover tus contactos en las sombras',attr:'des',dif:7,riesgo:''}];
  while(ops.length<3)ops.push(rel[ops.length]);
  return {n,titulo:cut(s.titulo||'Un nuevo día en el Cónclave',80),escena:cut(s.escena||'El Cónclave amanece tenso. Todos esperan a que alguien se mueva primero.',1400),opciones:ops,npc:normNpc(s.npc),amenaza:normAmenaza(s.amenaza)};
}
function normRes(d){
  d=d||{};const js={};
  Object.keys(P.jugadores).forEach(l=>{
    const r=(d.jugadores&&d.jugadores[l])||{},c={};
    RKEYS.forEach(k=>{const v=Math.round(Number(r.cambios&&r.cambios[k]));if(v)c[k]=clamp(v,k==='vig'?-4:-3,k==='eter'||k==='vig'?2:3);});
    const pt=Math.round(Number(r.puntaje));
    js[l]={resultado:cut(r.resultado||'Un día sin sobresaltos para ti, aunque la ciudad no olvida.',400),secreto:cut(r.secreto||'',400),cambios:c,xp:clamp(Math.round(Number(r.xp))||10,5,30),
      puntaje:isNaN(pt)?null:clamp(pt,0,100),leccion:cut(r.leccion||'',400),mision:cut(r.mision||'',200)};
  });
  return {cronica:cut(d.cronica||'El día transcurre entre susurros y cálculos.',1500),jugadores:js};
}

/* ---------- combate automático ---------- */
function simularCombate(l,am,postura){
  const j=P.jugadores[l],s=S.jug[l],pj=pjDe(l),og=ORIGENES[j.origen];
  const rec=clon(s.rec);let ev=am.vigor,marca=0,fin=null;const log=[];
  const elegir=()=>{
    let a=POSTURAS.filter(x=>x.id===postura)[0];
    if(!a&&String(postura).indexOf('poder:')===0){const id=postura.slice(6);if(og.pods.indexOf(id)>=0)a=posturaPoder(id);}
    if(!a)a=POSTURAS[0];
    if(a.coste&&rec.eter<a.coste)a=POSTURAS[0];
    return a;
  };
  for(let ronda=1;ronda<=5&&!fin;ronda++){
    const a=elegir();let t='Ronda '+ronda+'. '+a.t+': ',enemigoActua=true,extra=0;
    if(a.coste)rec.eter=clamp(rec.eter-a.coste,0,10);
    const dado=d6(),bono=bonoRolDe(a.attr,pj),total=dado+A(a.attr,pj)+bono+(a.huir?0:marca);
    const exito=dado===6||(dado!==1&&total>=a.dif);
    t+='dado '+dado+' + '+ATR[a.attr].n+' '+A(a.attr,pj)+(bono?' + cargo 1':'')+(!a.huir&&marca?' + marca '+marca:'')+' = '+total+' contra '+a.dif+'. ';
    if(!a.huir)marca=0;
    if(a.huir){if(exito){fin='huida';t+='Logras escabullirte.';}else t+='No logras escapar.';}
    else if(exito){
      const dm=a.dmg+(dado===6?1:0);ev=Math.max(0,ev-dm);t+='Impacto: −'+dm+' a la amenaza.';
      if(a.fx.skip&&ev>0){enemigoActua=false;t+=' No puede responder.';}
      if(a.fx.marca)marca=2;
    }else{
      t+='Fallas.';
      if(a.fx.expuesto){extra=2;t+=' Quedas expuesto.';}
      if(a.poder){rec[og.cae]=clamp(rec[og.cae]-1,0,10);t+=' '+og.caida;}
    }
    if(ev<=0)fin='victoria';
    if(!fin&&enemigoActua){
      const er=d6(),def=5+A('des',pj),tot=er+am.ataque+extra;
      t+=' Ataca: dado '+er+' + '+am.ataque+(extra?' + '+extra:'')+' = '+tot+' contra tu defensa '+def+'.';
      if(tot>=def){rec.vig=clamp(rec.vig-2,0,10);t+=' Te alcanza: −2 Vigor.';}else t+=' Falla.';
    }
    if(!fin&&rec.vig<=0)fin='derrota';
    log.push(t);
  }
  if(!fin)fin='empate';
  let dl={},xp;
  if(fin==='victoria'){dl={lea:1};xp=15;}else if(fin==='empate'){xp=8;}else if(fin==='huida'){dl={inf:-1};xp=3;}else{dl={cre:-2};xp=3;rec.vig=1;}
  for(const k in dl)rec[k]=clamp(rec[k]+dl[k],0,10);
  return {fin,log,rec,xp};
}

/* ---------- comandos ---------- */
async function cmdUnirse(){
  const l=autor.toLowerCase();
  const perm=(cfg.permitidos||[]).map(x=>String(x).toLowerCase());
  if(perm.length&&perm.indexOf(l)<0)throw usr('Tu usuario no está en la lista de jugadores permitidos de esta campaña.');
  if(P.jugadores[l])throw usr('Ya tienes un personaje en esta campaña.');
  if(Object.keys(P.jugadores).length>=MAX_JUG)throw usr('La mesa está llena (máximo '+MAX_JUG+' jugadores).');
  if(P.estado==='fin')throw usr('La campaña ya terminó.');
  const d=parseCuerpo();
  let sec;try{sec=await Cripto.descifrar(priv,d.sec);}catch(e){throw usr('No pude leer tus datos secretos. Revisa que config.json tenga la llave pública del director.');}
  const p={nombre:cut(d.nombre,24),casa:d.casa,origen:d.origen,rol:d.rol,attrs:d.attrs,soc:sec&&sec.soc,obj:sec&&sec.obj};
  const err=validaPersonaje(p);if(err)throw usr(err);
  if(!d.pub||d.pub.kty!=='RSA'||!d.pub.n)throw usr('Falta tu llave pública.');
  const rec=calcRec(p);
  P.jugadores[l]={login:autor,nombre:p.nombre.trim(),casa:p.casa,origen:p.origen,rol:p.rol,attrs:p.attrs,pub:{kty:'RSA',n:d.pub.n,e:d.pub.e,alg:'RSA-OAEP-256',ext:true,key_ops:['encrypt']},blob:'',actuo:false,inf:rec.inf};
  S.jug[l]={soc:p.soc,obj:p.obj,rec,xp:0,priv:[]};
  await actualizarBlob(l);
  return '¡Bienvenido a la mesa, **'+p.nombre.trim()+'**! Tu personaje quedó registrado. Cuando el anfitrión comience la campaña, el primer día aparecerá en la página.';
}
async function cmdComenzar(){
  if(!esHost())throw usr('Solo el anfitrión puede comenzar la campaña.');
  if(P.estado!=='lobby')throw usr('La campaña ya comenzó.');
  if(!Object.keys(P.jugadores).length)throw usr('Todavía no hay jugadores.');
  const d=await claudeJSON(promptGM('inicio'));
  if(!d||!d.siguiente)throw usr('El Director de juego no devolvió el primer día. Vuelve a intentarlo.');
  const dia=normDia(1,d.siguiente);
  S.verdad=cut(d.verdad,600);S.hechos=(Array.isArray(d.hechos)?d.hechos:[]).slice(0,6).map(x=>cut(x,180));S.resumen=cut(d.resumen,1200);
  S.dias[1]=dia;P.dias[1]=diaPublico(dia);P.dia=1;P.estado='abierto';
  return 'La campaña comenzó. **Día 1: '+dia.titulo+'**.';
}
async function cmdAccion(){
  const l=autor.toLowerCase(),j=P.jugadores[l];
  if(!j)throw usr('No tienes personaje en esta campaña.');
  if(P.estado!=='abierto')throw usr('La campaña no está en curso.');
  const d=parseCuerpo();
  if(Number(d.dia)!==P.dia)throw usr('Esa jugada es de otro día. Hoy es el día '+P.dia+'.');
  if(j.actuo)throw usr('Ya actuaste hoy.');
  let e;try{e=await Cripto.descifrar(priv,d.enc);}catch(x){throw usr('No pude leer tu jugada cifrada.');}
  const dia=S.dias[P.dia],s=S.jug[l],pj=pjDe(l),sel=d.sel;
  const a={tipo:null,poder:null,obj:null,int:null};
  if(e.obj){
    if(!P.jugadores[e.obj]||e.obj===l)throw usr('El jugador que elegiste no existe en la mesa.');
    if(!INT[e.int])throw usr('Intención inválida.');
    a.obj=e.obj;a.int=e.int;
  }
  if(sel==='amenaza'){
    if(!dia.amenaza)throw usr('Hoy no hay una amenaza que enfrentar.');
    const r=simularCombate(l,dia.amenaza,String(e.postura||'golpe'));
    s.rec=r.rec;s.xp+=r.xp;
    a.tipo='amenaza';a.desc='Enfrentó a '+dia.amenaza.nombre;a.combate={fin:r.fin,log:r.log};a.exito=r.fin==='victoria';a.dado=0;a.attr='com';a.dif=0;a.base=0;a.bono=0;a.total=0;
  }else{
    let attr,dif,desc,texto=cut(e.texto,300).trim();
    if(sel==='libre'){
      if(texto.length<3)throw usr('Describe tu acción.');
      if(!ATR[e.attr])throw usr('Atributo inválido.');
      a.tipo='libre';attr=e.attr;dif=7;desc=texto;
    }else if(sel==='npc'){
      if(!dia.npc)throw usr('Hoy no hay a quién hablar.');
      if(texto.length<3)throw usr('Escribe qué le dices.');
      if(!ATR[e.attr])throw usr('Atributo inválido.');
      a.tipo='npc';attr=e.attr;dif=7;desc='Habla con '+dia.npc.nombre+': '+texto;
    }else{
      const op=dia.opciones[Number(sel)];
      if(!op||!Number.isInteger(Number(sel)))throw usr('Opción inválida.');
      a.tipo='op';attr=op.attr;dif=op.dif;desc=op.t;
    }
    if(e.poder){
      const p=POD[e.poder];
      if(!p||podsDe(pj).indexOf(e.poder)<0)throw usr('No tienes ese poder.');
      if(s.rec.eter<p.coste)throw usr('No te alcanza el Éter para ese poder.');
      s.rec.eter=clamp(s.rec.eter-p.coste,0,10);a.poder=e.poder;
    }
    a.texto=texto;a.desc=desc;a.attr=attr;a.dif=dif;
    a.dado=d6();a.base=A(attr,pj);a.bono=bonoRolDe(attr,pj);a.total=a.dado+a.base+a.bono+(a.poder?2:0);
    a.exito=a.dado===6||(a.dado!==1&&a.total>=dif);
  }
  (S.acc[P.dia]=S.acc[P.dia]||{})[l]=a;
  j.actuo=true;
  await actualizarBlob(l);
  const faltan=Object.keys(P.jugadores).filter(x=>!P.jugadores[x].actuo).length;
  if(faltan===0){
    try{
      const m=await resolverDia();
      return 'Jugada registrada. Con esta, todos actuaron: el Director de juego resolvió el día. '+m;
    }catch(err){
      if(!(err instanceof UErr))throw err;
      return 'Jugada registrada. Todos actuaron, pero el Director de juego no pudo resolver el día ahora: '+err.message;
    }
  }
  return 'Jugada registrada. Faltan '+faltan+' jugador'+(faltan===1?'':'es')+' por actuar.';
}
async function resolverDia(){
  const n=P.dia,fin=n>=P.dur;
  const d=await claudeJSON(promptGM('cierre'));
  if(!fin&&!d.siguiente)throw usr('El Director de juego no devolvió el día siguiente. El anfitrión puede reintentarlo con «Cerrar el día ahora».');
  const res=normRes(d);
  S.verdad=cut(d.verdad||S.verdad,600);S.resumen=cut(d.resumen||S.resumen,1200);
  const nuevos=(Array.isArray(d.hechos)?d.hechos:[]).slice(0,4).map(x=>cut(x,180)).filter(Boolean);
  S.hechos=(S.hechos||[]).concat(nuevos).slice(-30);
  Object.keys(P.jugadores).forEach(l=>{
    const s=S.jug[l],r=res.jugadores[l];
    RKEYS.forEach(k=>{s.rec[k]=clamp(s.rec[k]+(r.cambios[k]||0),0,10);});
    if(podsDe(pjDe(l)).length)s.rec.eter=clamp(s.rec.eter+2,0,10);
    s.rec.vig=clamp(s.rec.vig+1,0,10);
    s.xp+=r.xp;
    s.priv.push({dia:n,txt:r.resultado,sec:r.secreto,cambios:r.cambios,xp:r.xp,puntaje:r.puntaje,leccion:r.leccion,mision:r.mision});
    s.priv=s.priv.slice(-30);
  });
  P.dias[n].res={cronica:res.cronica,hechos:nuevos};
  let msg;
  if(fin){P.estado='fin';P.epilogo=cut(d.epilogo||res.cronica,2000);msg='La campaña terminó.';}
  else{
    const dia=normDia(n+1,d.siguiente);S.dias[n+1]=dia;P.dias[n+1]=diaPublico(dia);P.dia=n+1;
    Object.keys(P.jugadores).forEach(l=>{P.jugadores[l].actuo=false;});
    msg='Comenzó el **día '+(n+1)+': '+dia.titulo+'**.';
  }
  for(const k of Object.keys(S.acc))if(Number(k)<n-1&&!(fin))delete S.acc[k];
  for(const l of Object.keys(P.jugadores))await actualizarBlob(l);
  return msg;
}
async function cmdCerrar(){
  if(!esHost())throw usr('Solo el anfitrión puede cerrar el día antes de tiempo.');
  if(P.estado!=='abierto')throw usr('La campaña no está en curso.');
  const m=await resolverDia();
  return 'El anfitrión cerró el día. '+m;
}
async function cmdReiniciar(){
  if(!esHost())throw usr('Solo el anfitrión puede reiniciar la campaña.');
  P=estadoInicial();S=secretoInicial();
  return 'La campaña se reinició. Todos los jugadores deben crear su personaje de nuevo.';
}

/* ---------- GitHub: comentar y cerrar la incidencia ---------- */
async function responder(msg){
  const repo=env.GITHUB_REPOSITORY,num=env.ISSUE_NUMBER,tok=env.GITHUB_TOKEN;
  if(!repo||!num||!tok||env.SIN_GITHUB){console.log('[respuesta]',msg);return;}
  const api=env.GITHUB_API_URL||'https://api.github.com';
  const h={authorization:'Bearer '+tok,accept:'application/vnd.github+json','content-type':'application/json','user-agent':'neon-y-ceniza'};
  try{
    await fetch(api+'/repos/'+repo+'/issues/'+num+'/comments',{method:'POST',headers:h,body:JSON.stringify({body:msg})});
    await fetch(api+'/repos/'+repo+'/issues/'+num,{method:'PATCH',headers:h,body:JSON.stringify({state:'closed'})});
  }catch(e){console.error('No pude responder en GitHub:',e.message);}
}

/* ---------- principal ---------- */
async function main(){
  titulo=env.ISSUE_TITLE||'';cuerpo=env.ISSUE_BODY||'';autor=env.ISSUE_USER||'';
  const cmd=(titulo.match(/^\[(\w+)\]/)||[])[1];
  if(!cmd||['unirse','accion','comenzar','cerrar','reiniciar'].indexOf(cmd)<0){console.log('Incidencia ignorada:',titulo);return;}
  cfg=leer('config.json',{});
  P=leer('estado.json',null)||estadoInicial();
  if(!P.host)P.host=String(env.REPO_OWNER||'').toLowerCase();
  const sec0=leer('secreto.json',{});
  let respuesta='';
  try{
    if(!cfg.clavePublica)throw usr('Falta la llave pública del director en config.json. Genera las llaves con claves.html.');
    if(!env.CLAVE_PRIVADA)throw usr('Falta el secreto CLAVE_PRIVADA en el repositorio.');
    try{priv=JSON.parse(env.CLAVE_PRIVADA);}catch(e){throw usr('El secreto CLAVE_PRIVADA no es un JSON válido.');}
    try{S=sec0.enc?await Cripto.descifrar(priv,sec0.enc):secretoInicial();}
    catch(e){throw usr('No pude abrir secreto.json con CLAVE_PRIVADA. ¿Cambiaste las llaves? Para empezar de cero, borra secreto.json y estado.json.');}
    const f={unirse:cmdUnirse,accion:cmdAccion,comenzar:cmdComenzar,cerrar:cmdCerrar,reiniciar:cmdReiniciar}[cmd];
    respuesta=await f();
    P.actualizado=new Date().toISOString();
    escribir('estado.json',P,1);
    escribir('secreto.json',{enc:await Cripto.cifrar(cfg.clavePublica,S)},1);
  }catch(e){
    if(e instanceof UErr)respuesta='⚠️ '+e.message;
    else{console.error(e);respuesta='⚠️ Ocurrió un error inesperado. Revisa la pestaña Actions del repositorio.';}
  }
  await responder(respuesta);
}
main().catch(e=>{console.error(e);process.exit(1);});
