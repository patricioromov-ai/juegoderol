/* Neón y Ceniza: cifrado híbrido (RSA-OAEP 2048 + AES-GCM 256) con Web Crypto.
   Funciona igual en el navegador y en Node 20+. Sirve para que los secretos de cada
   jugador viajen por un repositorio público sin que los demás puedan leerlos. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.Cripto=factory();
})(typeof self!=='undefined'?self:this,function(){
'use strict';

const g=typeof globalThis!=='undefined'?globalThis:self;
const cr=(g.crypto&&g.crypto.subtle)?g.crypto:(typeof require==='function'?require('node:crypto').webcrypto:null);
if(!cr)throw new Error('Este navegador no soporta cifrado (Web Crypto). Abre el juego con https.');
const subtle=cr.subtle;
const te=new TextEncoder(),td=new TextDecoder();
const RSA={name:'RSA-OAEP',hash:'SHA-256'};

function b64(u8){let s='';const CH=0x8000;for(let i=0;i<u8.length;i+=CH)s+=String.fromCharCode.apply(null,u8.subarray(i,i+CH));return btoa(s);}
function unb64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}

/* Devuelve {publica, privada} como JWK (objetos JSON). */
async function generarPar(){
  const par=await subtle.generateKey({name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['encrypt','decrypt']);
  return {publica:await subtle.exportKey('jwk',par.publicKey),privada:await subtle.exportKey('jwk',par.privateKey)};
}
/* Deriva la llave pública a partir de una privada JWK. */
function publicaDe(priv){return {kty:priv.kty,n:priv.n,e:priv.e,alg:'RSA-OAEP-256',ext:true,key_ops:['encrypt']};}

/* Cifra cualquier objeto JSON para el dueño de la llave pública. Devuelve un texto "k.iv.c" en base64. */
async function cifrar(pubJwk,obj){
  const pub=await subtle.importKey('jwk',pubJwk,RSA,false,['encrypt']);
  const aes=await subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt']);
  const raw=await subtle.exportKey('raw',aes);
  const iv=cr.getRandomValues(new Uint8Array(12));
  const c=await subtle.encrypt({name:'AES-GCM',iv},aes,te.encode(JSON.stringify(obj)));
  const k=await subtle.encrypt({name:'RSA-OAEP'},pub,raw);
  return [b64(new Uint8Array(k)),b64(iv),b64(new Uint8Array(c))].join('.');
}
/* Descifra con la llave privada JWK. Rechaza si el texto no es para esa llave. */
async function descifrar(privJwk,texto){
  const p=String(texto).split('.');
  if(p.length!==3)throw new Error('formato');
  const priv=await subtle.importKey('jwk',privJwk,RSA,false,['decrypt']);
  const raw=await subtle.decrypt({name:'RSA-OAEP'},priv,unb64(p[0]));
  const aes=await subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);
  const m=await subtle.decrypt({name:'AES-GCM',iv:unb64(p[1])},aes,unb64(p[2]));
  return JSON.parse(td.decode(m));
}
return {generarPar,publicaDe,cifrar,descifrar,b64,unb64};
});
