/* Neón y Ceniza: datos y reglas compartidos por la página (navegador) y el motor (Node). */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.NC=factory();
})(typeof self!=='undefined'?self:this,function(){
'use strict';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const sum=o=>Object.keys(o).reduce((a,k)=>a+o[k],0);

const REC={cre:'Créditos',inf:'Influencia',sec:'Secretos',lea:'Lealtad',eter:'Éter',vig:'Vigor'};
const REC_C={cre:'Créd.',inf:'Infl.',sec:'Secr.',lea:'Leal.',eter:'Éter',vig:'Vigor'};
const RKEYS=['cre','inf','sec','lea','eter','vig'];

const ATR={
  fue:{n:'Fuerza',g:'Cuerpo',d:'Potencia física: golpear, levantar, resistir'},
  des:{n:'Destreza',g:'Cuerpo',d:'Reflejos, sigilo y puntería'},
  com:{n:'Combate',g:'Cuerpo',d:'Técnica con armas y en las peleas'},
  sab:{n:'Sabiduría',g:'Mente',d:'Conocimiento, ocultismo, leyes y criterio'},
  psi:{n:'Psique',g:'Mente',d:'Telepatía, poderes mentales y defensa contra ellos'},
  ast:{n:'Astucia',g:'Mente',d:'Negocios, negociación y lectura de intenciones'},
  elo:{n:'Elocuencia',g:'Sociedad',d:'Oratoria, litigio y persuasión'},
  enc:{n:'Encanto',g:'Sociedad',d:'Seducción, carisma y presencia'},
  man:{n:'Mando',g:'Sociedad',d:'Liderazgo, poder y delegación'}
};
const ATR_ORDEN=['fue','des','com','sab','psi','ast','elo','enc','man'];
const GRUPOS=['Cuerpo','Mente','Sociedad'];
const PUNTOS=12;

const CASAS={
  vael:{n:'Vael',animal:'El Cuervo',gremio:'Datos y espionaje',lema:'Lo que se susurra, se sabe.',bono:{sec:1},glyph:'<path d="M9 33 L24 9 L39 33 L24 26 Z"/>'},
  orrin:{n:'Orrin',animal:'La Balanza',gremio:'Bancos y contratos',lema:'Todo se pesa.',bono:{cre:1},glyph:'<path d="M24 9v28M12 15h24M12 15l-5 11h10zM36 15l-5 11h10zM17 38h14"/>'},
  draven:{n:'Draven',animal:'El Lobo',gremio:'Milicias y seguridad',lema:'La manada no abandona.',bono:{lea:1},glyph:'<path d="M10 37 L13 12 L21 21 L27 21 L35 12 L38 37 L24 31Z"/>'},
  solmere:{n:'Solmere',animal:'El Sol Pálido',gremio:'Medios y espectáculo',lema:'Donde brilla, manda.',bono:{inf:1},glyph:'<circle cx="24" cy="24" r="7"/><path d="M24 7v6M24 35v6M7 24h6M35 24h6M12 12l4 4M32 32l4 4M36 12l-4 4M16 32l-4 4"/>'},
  kesh:{n:'Kesh',animal:'La Espina',gremio:'Biotecnología y venenos',lema:'Quien nos toca, sangra.',bono:{vig:1},glyph:'<path d="M24 7l4 15 14 2-14 4-4 13-4-13-14-4 14-2z"/>'},
  thale:{n:'Thale',animal:'La Marea',gremio:'Puertos y contrabando',lema:'Lo que se va, vuelve.',bono:{cre:1},glyph:'<path d="M8 17q4-5 8 0t8 0 8 0 8 0M8 26q4-5 8 0t8 0 8 0 8 0M8 35q4-5 8 0t8 0 8 0 8 0"/>'},
  umbra:{n:'Umbra',animal:'La Ceniza',gremio:'Cultos y ocultismo',lema:'Del fuego, lo que queda.',bono:{eter:1},glyph:'<path d="M24 8c8 9 12 16 6 25-3 4-9 4-11-1-3-6 2-12 5-24z"/>'}
};
const POD={
  reflejos:{n:'Reflejos sinápticos',tipo:'sombra',attr:'des',coste:2,d:'Tus implantes aceleran el tiempo a tu alrededor durante unos segundos.'},
  brazo:{n:'Brazo hidráulico',tipo:'fuerza',attr:'fue',coste:2,d:'Un implante de titanio multiplica tu fuerza.'},
  voz:{n:'Voz de serafín',tipo:'presencia',attr:'enc',coste:2,d:'Tu voz resuena con una autoridad que nadie puede ignorar.'},
  juicio:{n:'Ojo del juicio',tipo:'vision',attr:'sab',coste:2,d:'Ves la verdad detrás de las palabras y de las intenciones.'},
  susurro:{n:'Susurro infernal',tipo:'mente',attr:'psi',coste:2,d:'Plantas una idea en la mente de otro como si fuera suya.'},
  garras:{n:'Garras del pacto',tipo:'fuerza',attr:'com',coste:2,d:'Tus manos se cubren de ceniza ardiente y cortan lo que tocan.'},
  bendicion:{n:'Aura del Panteón',tipo:'presencia',attr:'man',coste:2,d:'Tu presencia impone respeto: hasta los escépticos bajan la mirada.'},
  fulgor:{n:'Fulgor divino',tipo:'fuerza',attr:'com',coste:2,d:'Un rayo de luz sagrada sale de tus manos y quema lo que toca.'},
  telepatia:{n:'Telepatía',tipo:'mente',attr:'psi',coste:2,d:'Escuchas pensamientos superficiales y puedes enviar los tuyos.'},
  hilos:{n:'Visión de hilos',tipo:'vision',attr:'sab',coste:2,d:'Ves los rastros del pasado y las líneas del futuro cercano.'}
};
const ORIGENES={
  cyber:{n:'Humano aumentado',d:'Implantes de combate y sistemas neuronales. Lo que te falta de carne lo pone el metal.',attr:{fue:1,des:1},pods:['reflejos','brazo'],eter:3,cae:'vig',caida:'Sobrecarga: si un poder falla, pierdes 1 Vigor.'},
  angel:{n:'Sangre angelical',d:'Descendiente de los que cruzaron la Grieta desde arriba. Tu presencia incomoda a los que mienten.',attr:{enc:1,sab:1},pods:['voz','juicio'],eter:4,cae:'sec',caida:'Luz incómoda: si un poder falla, pierdes 1 Secreto.'},
  demonio:{n:'Pacto demoníaco',d:'Alguien de tu linaje firmó con lo de abajo. Tú pagas los intereses y cobras los dones.',attr:{psi:1,com:1},pods:['susurro','garras'],eter:4,cae:'lea',caida:'El pacto cobra: si un poder falla, pierdes 1 Lealtad.'},
  divino:{n:'Linaje divino',d:'Semidiós o semidiosa de un dios dormido en los servidores del Panteón.',attr:{man:1,fue:1},pods:['bendicion','fulgor'],eter:4,cae:'inf',caida:'Orgullo: si un poder falla, pierdes 1 Influencia.'},
  psiquico:{n:'Mente despierta',d:'Tu mente oye lo que otros callan. Nadie te explicó por qué, y nadie puede dejar de mirarte.',attr:{psi:1,sab:1},pods:['telepatia','hilos'],eter:5,cae:'vig',caida:'Ruido mental: si un poder falla, pierdes 1 Vigor.'},
  mortal:{n:'Mortal sin dones',d:'Sin sangre especial ni implantes: tu poder son tus decisiones. Ganas 2 puntos de atributo extra y 2 Créditos.',attr:{},pods:[],eter:0,extra:2,rec:{cre:2}}
};
const ROLES={
  litigante:{n:'Litigante',d:'Abogado de Casa. Gana guerras con cláusulas, no con armas.',attr:'elo',rec:{inf:2},caida:'inf',
    ventaja:'Argumento letal: +1 a las tiradas de Elocuencia.',caidaTxt:'Cláusulas ocultas: si fallas con Elocuencia, pierdes 1 Influencia.'},
  magnate:{n:'Magnate',d:'Controla bancos, rutas y deudas. Todo tiene un precio.',attr:'ast',rec:{cre:2},caida:'cre',
    ventaja:'Ojo para el negocio: +1 a las tiradas de Astucia.',caidaTxt:'Apuestas altas: si fallas con Astucia, pierdes 1 Crédito.'},
  operador:{n:'Operador de sombras',d:'Infiltra, roba y desaparece. Vive de los secretos ajenos.',attr:'des',rec:{sec:2},caida:'sec',
    ventaja:'Pies de gato: +1 a las tiradas de Destreza.',caidaTxt:'Red expuesta: si fallas con Destreza, pierdes 1 Secreto.'},
  caballero:{n:'Caballero de guardia',d:'Espada monofilamento, armadura ligera y juramento de lealtad.',attr:'com',rec:{lea:1,vig:2},caida:'vig',
    ventaja:'Maestría de armas: +1 a las tiradas de Combate.',caidaTxt:'Heridas de honor: si fallas con Combate, pierdes 1 Vigor.'},
  archivista:{n:'Archivista',d:'Conoce las leyes, la historia y los viejos pactos.',attr:'sab',rec:{sec:1,inf:1},caida:'inf',
    ventaja:'Memoria de archivo: +1 a las tiradas de Sabiduría.',caidaTxt:'Torre de marfil: si fallas con Sabiduría, pierdes 1 Influencia.'},
  oraculo:{n:'Oráculo',d:'Guía de fieles y de mentes. Hablan con él lo que nadie se atreve a decir.',attr:'psi',rec:{eter:2,lea:1},caida:'lea',
    ventaja:'Trance profundo: +1 a las tiradas de Psique.',caidaTxt:'Dudas de fe: si fallas con Psique, pierdes 1 Lealtad.'},
  cortesano:{n:'Cortesano',d:'Domina el salón, la mirada y el momento justo. La seducción es su arma.',attr:'enc',rec:{inf:1,sec:1},caida:'lea',
    ventaja:'Presencia magnética: +1 a las tiradas de Encanto.',caidaTxt:'Juegos peligrosos: si fallas con Encanto, pierdes 1 Lealtad.'}
};
const SOC={
  logia:{n:'La Logia del Compás',d:'Masonería del siglo XXI: hermanos en cada torre, grados de iniciación y favores que se cobran.',rec:{inf:1,sec:1}},
  velo:{n:'La Orden del Velo Negro',d:'Culto de pactos y rituales, con acólitos entre los nobles.',rec:{eter:1,sec:1}},
  serafines:{n:'Los Serafines de Acero',d:'Cazadores de pactos infernales, con armadura y bendición.',rec:{lea:1,vig:1}},
  redcero:{n:'Red Cero',d:'Hackers y telépatas que operan en las redes y en las mentes.',rec:{eter:1,cre:1}},
  ninguna:{n:'Ninguna',d:'Sin hermanos, sin deudas y sin protectores.',rec:{cre:2}}
};
const OBJ={
  corona:{n:'Coronar a tu candidato',txt:'coronar a tu candidato',res:'inf',meta:8,d:'Tu Casa apoya en secreto a un aspirante. Necesitas Influencia para imponerlo.'},
  tesoro:{n:'Quedarte con la fortuna del Soberano',txt:'quedarte con la fortuna del Soberano',res:'cre',meta:8,d:'Las cuentas del Soberano valen más que su corona. Necesitas Créditos para llegar a ellas.'},
  verdad:{n:'Descubrir quién mató al Soberano',txt:'descubrir quién mató al Soberano',res:'sec',meta:8,d:'La copa estaba intacta y la ventana abierta. Necesitas Secretos para reconstruir la noche.'},
  paz:{n:'Evitar la guerra civil',txt:'evitar la guerra civil',res:'lea',meta:8,d:'Si el plazo vence, la ciudad se decide con acero. Necesitas Lealtad para sostener la paz.'},
  ascenso:{n:'Alcanzar tu máximo poder',txt:'alcanzar tu máximo poder',res:'eter',meta:8,d:'La Grieta te llama. Necesitas Éter para responderle.',soloPoder:true}
};
const INT={aliarse:'proponerle una alianza',ayudar:'ayudarle',seducir:'seducirle o encantarle',espiar:'espiarle',amenazar:'amenazarle',traicionar:'traicionarle'};
const INT_TXT={aliarse:'Proponer una alianza',ayudar:'Ayudarle',seducir:'Seducirle o encantarle',espiar:'Espiarle',amenazar:'Amenazarle',traicionar:'Traicionarle'};
const CMB_POD={
  fuerza:{dmg:4,fx:{},nota:'Daño alto.'},
  mente:{dmg:2,fx:{skip:true},nota:'Los desorienta: no atacan esta ronda.'},
  vision:{dmg:1,fx:{marca:true},nota:'Marca un punto débil: tu próximo ataque suma +2.'},
  presencia:{dmg:1,fx:{skip:true},nota:'Los intimida: no atacan esta ronda.'},
  sombra:{dmg:2,fx:{skip:true},nota:'Golpeas desde las sombras: no atacan esta ronda.'}
};
const GIROS=['una traición dentro de una alianza','la aparición de un ángel que exige algo a cambio','un demonio que ofrece un pacto a alguien','un escándalo financiero que salpica a una Casa','la Logia cobra un favor imposible','un ataque a los servidores del Panteón','un asesinato político en plena gala','una revelación incómoda sobre el pasado del Soberano','un hackeo telepático que expone pensamientos privados','un duelo de honor que nadie quiere','un baile de máscaras donde nadie es quien parece','una filtración de secretos íntimos','un dios dormido que empieza a despertar','un golpe de mercado que arruina a una Casa'];
const SEMILLAS=['ámbar','lluvia ácida','cuervo','espejo','sal','violeta','brasa','cristal','órbita','hiedra','plomo','eco'];

/* posturas de combate automáticas (para el motor) */
const POSTURAS=[
  {id:'golpe',t:'Golpear con tu arma',attr:'com',dif:7,dmg:2,fx:{},nota:'Ataque directo.'},
  {id:'embestir',t:'Embestir con fuerza bruta',attr:'fue',dif:8,dmg:3,fx:{expuesto:true},nota:'Más daño. Si fallas, quedas expuesto.'},
  {id:'esquivar',t:'Esquivar y contraatacar',attr:'des',dif:7,dmg:1,fx:{skip:true},nota:'Si aciertas, evitas su ataque.'},
  {id:'huir',t:'Retirarte por la escalera de servicio',attr:'des',dif:8,dmg:0,fx:{},huir:true,nota:'Escapas, pero se sabrá.'}
];
function posturaPoder(id){
  const p=POD[id];if(!p)return null;const c=CMB_POD[p.tipo];
  return {id:'poder:'+id,t:p.n,attr:p.attr,dif:6,dmg:c.dmg,fx:c.fx,coste:p.coste,poder:true,nota:c.nota};
}

const podsDe=p=>p&&p.origen&&ORIGENES[p.origen]?ORIGENES[p.origen].pods:[];
function A(k,p){const og=p.origen?ORIGENES[p.origen]:null;return p.attrs[k]+((og&&og.attr[k])||0);}
function bonoRolDe(k,p){return p&&p.rol&&ROLES[p.rol]&&ROLES[p.rol].attr===k?1:0;}
const puntosTotal=p=>PUNTOS+((p.origen&&ORIGENES[p.origen]&&ORIGENES[p.origen].extra)||0);
function calcRec(p){
  const r={cre:3,inf:3,sec:3,lea:3,eter:0,vig:0},ro=ROLES[p.rol],ca=CASAS[p.casa],og=ORIGENES[p.origen],so=SOC[p.soc];
  [ro.rec,ca.bono,og.rec||{},so.rec].forEach(o=>{for(const k in o)r[k]+=o[k];});
  r.eter=og.pods.length?r.eter+og.eter:0;
  r.vig+=4+A('fue',p);
  RKEYS.forEach(k=>{r[k]=clamp(r[k],0,10);});
  return r;
}
/* devuelve un texto de error o null si el personaje es válido */
function validaPersonaje(p){
  if(!p||typeof p!=='object')return 'Personaje inválido.';
  const nombre=String(p.nombre||'').trim();
  if(nombre.length<2||nombre.length>24)return 'El nombre debe tener entre 2 y 24 letras.';
  if(!CASAS[p.casa])return 'Casa inválida.';
  if(!ORIGENES[p.origen])return 'Origen inválido.';
  if(!ROLES[p.rol])return 'Cargo inválido.';
  if(!SOC[p.soc])return 'Sociedad secreta inválida.';
  if(!OBJ[p.obj])return 'Objetivo inválido.';
  if(OBJ[p.obj].soloPoder&&!ORIGENES[p.origen].pods.length)return 'Ese objetivo requiere poderes.';
  if(!p.attrs||typeof p.attrs!=='object')return 'Faltan atributos.';
  for(const k of ATR_ORDEN){const v=p.attrs[k];if(!Number.isInteger(v)||v<1||v>5)return 'Atributo inválido: '+k+'.';}
  if(sum(p.attrs)-ATR_ORDEN.length!==puntosTotal(p))return 'Debes repartir exactamente '+puntosTotal(p)+' puntos de atributo.';
  return null;
}

return {clamp,sum,REC,REC_C,RKEYS,ATR,ATR_ORDEN,GRUPOS,PUNTOS,CASAS,POD,ORIGENES,ROLES,SOC,OBJ,INT,INT_TXT,CMB_POD,GIROS,SEMILLAS,POSTURAS,posturaPoder,podsDe,A,bonoRolDe,puntosTotal,calcRec,validaPersonaje};
});
