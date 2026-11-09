(function(){
const K='st-event-v1',L=new Set();
const STARTUPS=[
{name:'Aurora Agro',ods:'ODS 2 · Hambre cero',desc:'Ejemplo de startup. Reemplazar con datos reales.'},
{name:'Nodo Solar',ods:'ODS 7 · Energía asequible',desc:'Ejemplo de startup. Reemplazar con datos reales.'},
{name:'Aqua Lima',ods:'ODS 6 · Agua limpia',desc:'Ejemplo de startup. Reemplazar con datos reales.'},
{name:'Tejido Vivo',ods:'ODS 12 · Producción responsable',desc:'Ejemplo de startup. Reemplazar con datos reales.'},
{name:'Ruta Verde',ods:'ODS 11 · Ciudades sostenibles',desc:'Ejemplo de startup. Reemplazar con datos reales.'}];
const init=()=>({r:0,phase:'scheduled',total:0,investors:0,lastCallAt:0,votes:[null,null,null,null],hist:[],mults:[],stats:[],log:[],undo:null,manual:false,manualBacks:2,anul:null,simSala:true,rev:0,epoch:Date.now()});
function get(){try{const s=JSON.parse(localStorage.getItem(K));if(s)return s}catch(e){}return init()}
function set(s){s.rev=(s.rev||0)+1;localStorage.setItem(K,JSON.stringify(s));L.forEach(f=>f(s))}
function update(fn){const s=get();fn(s);set(s);return s}
function subscribe(cb){L.add(cb);const on=e=>{if(e.key===K)cb(get())};addEventListener('storage',on);let rev=get().rev;const p=setInterval(()=>{const s=get();if(s.rev!==rev){rev=s.rev;cb(s)}},1000);return()=>{L.delete(cb);removeEventListener('storage',on);clearInterval(p)}}
const price=t=>Math.round(Math.min(200,Math.max(50,100+t/2000)));
function calc(votes){const v=votes.filter(x=>x&&x!=='abstiene'),b=v.filter(x=>x==='respalda').length;const frac=v.length?b/v.length:.5;return{backs:b,voters:v.length,frac,mult:0.2+1.6*frac}}
const remaining=s=>s.phase==='last'?Math.max(0,60-Math.floor((Date.now()-s.lastCallAt)/1000)):0;
const ORDER=['scheduled','open','last','closed','voting','result'];
const note=(s,a)=>s.log.push({t:Date.now(),a,r:s.r});
function checkTimer(){const s=get();if(s.phase==='last'&&remaining(s)===0)update(x=>{if(x.phase==='last'){x.phase='closed';note(x,'CIERRE_AUTOMATICO')}})}
function advance(){update(s=>{const prev=JSON.parse(JSON.stringify(s));delete prev.log;delete prev.undo;const p=s.phase;
if(p==='scheduled'){s.phase='open';note(s,'ABRIR');s.undo=prev}
else if(p==='open'){s.phase='last';s.lastCallAt=Date.now();note(s,'ULTIMA_LLAMADA');s.undo=prev}
else if(p==='last'){s.phase='closed';note(s,'CERRAR');s.undo=prev}
else if(p==='closed'){s.phase='voting';note(s,'HABILITAR_VOTO');s.undo=prev}
else if(p==='voting'){const full=s.votes.every(x=>x);if(!full&&!s.manual)return;
let c=full?calc(s.votes):{backs:s.manualBacks,voters:4,frac:s.manualBacks/4,mult:0.2+1.6*s.manualBacks/4};
if(s.manual)c={backs:s.manualBacks,voters:4,frac:s.manualBacks/4,mult:0.2+1.6*s.manualBacks/4};
s.mults[s.r]=c.mult;s.stats[s.r]={total:s.total,investors:s.investors,frac:c.frac,mult:c.mult,backs:c.backs,voters:c.voters};s.hist[s.r]=s.votes.slice();s.phase='result';note(s,'REVELAR');s.undo=null}
else if(p==='result'||p==='anulada'){s.undo=null;if(s.r>=4){s.phase='final';note(s,'CERRAR_EVENTO')}else{s.r++;s.phase='scheduled';s.total=0;s.investors=0;s.votes=[null,null,null,null];s.lastCallAt=0;s.anul=null;note(s,'SIGUIENTE')}}})}
function undo(){update(s=>{if(!s.undo)return;const l=s.log;Object.assign(s,s.undo);s.log=l;s.undo=null;note(s,'DESHACER')})}
function anular(mode){update(s=>{if(s.phase!=='closed'&&s.phase!=='voting')return;s.phase='anulada';s.anul=mode;s.mults[s.r]=1;s.stats[s.r]={anulada:true,total:s.total,investors:s.investors,frac:0,mult:1};s.hist[s.r]=s.votes.slice();s.undo=null;note(s,'ANULAR_'+mode.toUpperCase())})}
function vote(i,d){update(s=>{if(s.phase==='voting'&&!s.votes[i])s.votes[i]=d})}
function simulateVotes(){update(s=>{s.votes=s.votes.map(v=>v||(()=>{const x=Math.random();return x<.55?'respalda':x<.9?'rechaza':'abstiene'})())})}
function reset(){const e=init();localStorage.setItem(K,JSON.stringify(e));L.forEach(f=>f(e))}
function rnd(i,k){const x=Math.sin(i*127.1+k*311.7)*43758.5453;return x-Math.floor(x)}
function others(mults){return Array.from({length:73},(_,i)=>{let s=10000;mults.forEach((m,k)=>{if(m===undefined)return;s+=s*0.3*rnd(i,k)*(m-1)});return Math.round(s)})}
function leaderboard(saldo,mults){const o=others(mults).map((s,i)=>({name:'Asistente '+String(i+1).padStart(2,'0'),saldo:s}));const pos=1+o.filter(x=>x.saldo>saldo).length;const all=o.concat([{name:'Tú',saldo:Math.round(saldo),me:true}]).sort((a,b)=>b.saldo-a.saldo);return{pos,top:all.slice(0,3),total:74,all}}
function startSim(){const id=Math.random().toString(36).slice(2);setInterval(()=>{const l=(localStorage.getItem('st-sim')||'|0').split('|');if(l[0]&&l[0]!==id&&Date.now()-Number(l[1])<4500)return;localStorage.setItem('st-sim',id+'|'+Date.now());const s=get();if(s.simSala&&(s.phase==='open'||s.phase==='last'))update(x=>{x.total+=250+Math.floor(Math.random()*1800);x.investors=Math.min(70,x.investors+1+(Math.random()>.6?1:0))})},3000)}
window.STStore={STARTUPS,get,set,update,subscribe,price,calc,remaining,ORDER,checkTimer,advance,undo,anular,vote,simulateVotes,reset,leaderboard,others,startSim,fmt:n=>Math.round(n).toLocaleString('en-US')};
})();
