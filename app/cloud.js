/* Montador de painéis elétricos — integração com a nuvem (API + banco de dados).
   Carregado somente na versão hospedada (index.html com <meta name="app-cloud" content="1">). */
(function(){
'use strict';
if(!document.querySelector('meta[name="app-cloud"]'))return;
const C={user:null,status:'off',saveT:0,setT:0,busy:false,pending:false,list:[],org:null,applying:false};window.CLOUD=C;
const SETKEYS={'qc-company':'company','qc-logo':'logo','qc-logo-app':'logoApp','qc-logo-same':'logoSame','qc-theme':'theme','qc-projects':null};
const rawSet=Storage.prototype.setItem,rawRemove=Storage.prototype.removeItem;
async function api(path,opt={}){const r=await fetch('/api'+path,{method:opt.method||'GET',headers:opt.body?{'Content-Type':'application/json'}:{},body:opt.body?JSON.stringify(opt.body):undefined,credentials:'same-origin'});
  let j={};try{j=await r.json()}catch(e){}if(!r.ok){const e=new Error(j.error||('Erro '+r.status));e.status=r.status;e.data=j;throw e}return j}
const $=s=>document.querySelector(s),esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const say=m=>{try{toast(m)}catch(e){}};

/* ---------- estilos ---------- */
const css=document.createElement('style');css.textContent=`
.cl-gate{position:fixed;inset:0;z-index:90;display:grid;place-items:center;background:radial-gradient(120% 90% at 50% 0%,color-mix(in srgb,var(--neutral) 18%,var(--bg)),var(--bg));padding:20px}
.cl-card{width:min(420px,100%);background:var(--surface);border:1px solid var(--line);border-radius:18px;box-shadow:var(--sh-3);padding:26px 24px}
.cl-card h2{margin:10px 0 2px;font:700 22px/1.2 "Barlow Condensed",sans-serif}.cl-card p{color:var(--muted);margin:0 0 14px;font-size:14px}
.cl-card label{display:grid;gap:4px;font-size:13px;color:var(--muted);margin-bottom:10px}.cl-card input{height:40px}
.cl-tabs{display:flex;gap:4px;background:var(--surface2);border-radius:10px;padding:3px;margin-bottom:14px}.cl-tabs button{flex:1;border:0;background:none;padding:8px;border-radius:8px;font-weight:600;color:var(--muted);cursor:pointer}
.cl-tabs button[aria-selected="true"]{background:var(--surface);color:var(--ink);box-shadow:var(--sh-1)}
.cl-err{color:var(--stop);font-weight:600;font-size:13.5px;min-height:18px;margin:4px 0 8px}
.cl-chip{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--muted);padding:4px 10px;border:1px solid var(--line);border-radius:999px;background:var(--surface2);white-space:nowrap}
.cl-chip i{width:8px;height:8px;border-radius:50%;background:var(--muted)}.cl-chip.ok i{background:var(--run)}.cl-chip.busy i{background:var(--warn)}.cl-chip.err i{background:var(--stop)}
.cl-row{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;border:1px solid var(--line);border-radius:10px;padding:9px 11px;background:var(--surface);margin-bottom:6px}
.cl-row small{display:block;color:var(--muted);font-size:12px}.cl-row .a{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.cl-row.cur{border-color:color-mix(in srgb,var(--neutral) 55%,var(--line))}
.cl-code{font:700 18px/1 ui-monospace,Consolas,monospace;letter-spacing:.12em;padding:8px 12px;border:1px dashed var(--line);border-radius:8px;background:var(--surface2)}`;
document.head.appendChild(css);

/* ---------- espelho do armazenamento local na nuvem ---------- */
Storage.prototype.setItem=function(k,v){rawSet.call(this,k,v);if(this!==localStorage||C.applying||!C.user)return;
  if(k==='qc-state-v1')queueSave();else if(k in SETKEYS&&SETKEYS[k])queueSettings()};
Storage.prototype.removeItem=function(k){rawRemove.call(this,k);if(this===localStorage&&!C.applying&&C.user&&SETKEYS[k])queueSettings()};
function setStatus(st,msg){C.status=st;const c=$('#clChip');if(c){c.className='cl-chip '+st;c.innerHTML=`<i></i>${esc(msg)}`}}
function snap(){const d=JSON.parse(JSON.stringify(state));delete d._cloudAt;return JSON.stringify(d)}
function queueSave(){if(!state||!state.cloudId){setStatus('ok','Projeto local · use "Salvar projeto"');return}if(snap()===C.last){if(!C.saveT&&!C.busy)setStatus('ok','Salvo na nuvem');return}setStatus('busy','Alterações pendentes…');if(!C.saveT)C.saveT=setTimeout(()=>{C.saveT=0;pushProject(false)},2500)}
function queueSettings(){clearTimeout(C.setT);C.setT=setTimeout(pushSettings,1500)}
function settingsData(){const d={};for(const [k,f] of Object.entries(SETKEYS)){if(!f)continue;const v=localStorage.getItem(k);d[f]=v===null?null:(k==='qc-logo'||k==='qc-logo-app'||k==='qc-logo-same')?v:JSON.parse(v)}return d}
async function pushSettings(){try{const r=await api('/settings',{method:'PUT',body:{data:settingsData()}});rawSet.call(localStorage,'qc-cloud-settings-at',r.updated_at||'')}catch(e){setStatus('err','Falha ao salvar configurações')}}
async function pushProject(version,note){if(!state||!state.cloudId)return;if(C.busy){C.pending=true;return}C.busy=true;setStatus('busy','Salvando…');
  try{const data=JSON.parse(JSON.stringify(state));const r=await api('/projects/'+state.cloudId,{method:'PUT',body:{data,name:(curName?curName():''),version:!!version,note,base_updated_at:state._cloudAt||undefined,force:!!version}});
    C.applying=true;state._cloudAt=r.updated_at;C.last=JSON.stringify((({_cloudAt,...x})=>x)(data));rawSet.call(localStorage,'qc-state-v1',JSON.stringify(state));C.applying=false;setStatus(snap()===C.last?'ok':'busy',snap()===C.last?'Salvo na nuvem':'Alterações pendentes…');if(snap()!==C.last)queueSave()}
  catch(e){if(e.status===409){setStatus('err','Alterado por outra pessoa');say('Este projeto foi alterado por outra pessoa. Use "Salvar projeto" para gravar a sua versão ou reabra o projeto.')}else if(e.status===401){gate()}else setStatus('err','Sem conexão: tentando de novo');if(e.status!==409&&e.status!==401)setTimeout(()=>pushProject(version,note),8000)}
  finally{C.busy=false;if(C.pending){C.pending=false;pushProject(false)}}}

/* ---------- substituições das funções de projeto do app ---------- */
window.saveProject=async function(asNew){try{const nm=($('#pjName')&&$('#pjName').value.trim())||curName();
  if(!state.cloudId||asNew){const data=JSON.parse(JSON.stringify(state));delete data.cloudId;delete data._cloudAt;const r=await api('/projects',{method:'POST',body:{name:nm,data}});state.cloudId=r.id;state._cloudAt=r.updated_at;save();await pushProject(false);projMsg=`Projeto "${nm}" salvo na nuvem.`}
  else{await pushProject(true,'Salvo manualmente');projMsg=`Projeto "${nm}" salvo na nuvem (nova versão).`}
  api('/me/prefs',{method:'PUT',body:{lastProject:state.cloudId}}).catch(()=>{});say(projMsg);if($('#cfgDlg').open)renderCfg()}catch(e){say(e.message)}};
window.projHTML=function(){return `<fieldset><legend>Projetos na nuvem</legend><p class="cap" style="margin:0 0 8px">Os projetos ficam no banco de dados da empresa <b>${esc(C.user.org.name)}</b>, com histórico de versões e salvamento automático.</p>
  <label class="f"><span>Nome para salvar</span><input type="text" id="pjName" value="${esc(curName())}"></label>
  <div class="rowb"><button class="btn small primary" data-act="pjsave">${state.cloudId?'Salvar nova versão':'Salvar na nuvem'}</button>${state.cloudId?'<button class="btn small" data-act="pjsavenew">Salvar como novo</button>':''}<button class="btn small" data-act="clopen">Abrir projetos da nuvem…</button><button class="btn small" data-act="pjexport">Exportar arquivo (.json)</button><button class="btn small" data-act="pjimport">Importar arquivo</button></div></fieldset>`};

/* ---------- diálogo de projetos ---------- */
function dlg(){let d=$('#clDlg');if(!d){d=document.createElement('dialog');d.id='clDlg';d.className='dlg';document.body.appendChild(d)}return d}
async function openProjects(q){const d=dlg();d.innerHTML=`<div class="dh"><h2>Projetos na nuvem</h2><button class="x" data-act="clclose" aria-label="Fechar">×</button></div><div class="db"><p class="cap">Carregando…</p></div>`;if(!d.open)d.showModal();
  try{const r=await api('/projects'+(q?`?q=${encodeURIComponent(q)}`:''));C.list=r.projects;renderProjects(q||'')}catch(e){d.querySelector('.db').innerHTML=`<p class="cl-err">${esc(e.message)}</p>`}}
function fmtD(s){try{return new Date(s).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}catch(e){return s}}
const KN={comando:'Quadro de comando',forca:'Quadro de força',primaria:'Cabine primária'};
function renderProjects(q){const d=dlg();const loc=Object.entries(typeof PROJS==='object'?PROJS:{});
  d.innerHTML=`<div class="dh"><h2>Projetos na nuvem · ${esc(C.user.org.name)}</h2><button class="x" data-act="clclose" aria-label="Fechar">×</button></div>
  <div class="db"><div class="rowb" style="margin:6px 0 10px"><input type="text" id="clQ" placeholder="Buscar pelo nome" value="${esc(q)}" style="flex:1;min-width:180px"><button class="btn small" data-act="clsearch">Buscar</button><button class="btn small primary" data-act="clnew">Novo projeto</button></div>
  ${C.list.length?C.list.map(p=>`<div class="cl-row ${p.id===state.cloudId?'cur':''}"><div><b>${esc(p.name)}</b>${p.id===state.cloudId?' <small style="display:inline">· aberto</small>':''}<small>${KN[p.kind]||p.kind} · atualizado em ${fmtD(p.updated_at)}${p.updated_by_name?' por '+esc(p.updated_by_name):''}</small></div>
    <div class="a"><button class="btn small" data-act="clload" data-v="${p.id}">Abrir</button><button class="btn small" data-act="clhist" data-v="${p.id}">Histórico</button><button class="btn small" data-act="cldel" data-v="${p.id}">Excluir</button></div></div>`).join(''):'<p class="cap">Nenhum projeto na nuvem ainda. Use "Salvar projeto" para enviar o projeto aberto.</p>'}
  ${loc.length?`<h3 style="margin-top:16px">Projetos guardados só neste navegador</h3>${loc.map(([id,p])=>`<div class="cl-row"><div><b>${esc(p.name)}</b><small>salvo em ${fmtD(p.saved)}</small></div><div class="a"><button class="btn small" data-act="clup" data-v="${id}">Enviar para a nuvem</button></div></div>`).join('')}`:''}</div>`}
async function loadCloud(id){try{const r=await api('/projects/'+id);const data=r.data;data.cloudId=r.id;data._cloudAt=r.updated_at;C.applying=true;try{loadProject(data)}finally{C.applying=false}C.last=snap();rawSet.call(localStorage,'qc-state-v1',JSON.stringify(state));
  api('/me/prefs',{method:'PUT',body:{lastProject:id}}).catch(()=>{});setStatus('ok','Salvo na nuvem');say(`Projeto "${r.name}" aberto.`);dlg().close()}catch(e){say(e.message)}}
async function history(id){const d=dlg();try{const r=await api(`/projects/${id}/versions`);const p=C.list.find(x=>x.id===id)||{name:''};
  d.querySelector('.db').innerHTML=`<p><button class="btn small" data-act="clback">← Voltar</button></p><h3>Histórico · ${esc(p.name)}</h3>${r.versions.map(v=>`<div class="cl-row"><div><b>${esc(v.note||'Versão')}</b><small>${fmtD(v.created_at)}${v.by_name?' · '+esc(v.by_name):''}</small></div><div class="a"><button class="btn small" data-act="clrestore" data-v="${id}" data-w="${v.id}">Restaurar</button></div></div>`).join('')}`}catch(e){say(e.message)}}
async function userMenu(){const d=dlg();let org=null;try{org=await api('/org')}catch(e){}
  d.innerHTML=`<div class="dh"><h2>Conta</h2><button class="x" data-act="clclose" aria-label="Fechar">×</button></div><div class="db">
  <fieldset><legend>Você</legend><p style="margin:4px 0"><b>${esc(C.user.name)}</b> · ${esc(C.user.email)}</p><p class="cap" style="margin:0">Perfil: ${C.user.role==='admin'?'administrador':'membro'} · Empresa: ${esc(C.user.org.name)}</p></fieldset>
  ${org&&org.org.invite_code?`<fieldset><legend>Convidar a equipe</legend><p class="cap">Quem criar conta com este código entra na sua empresa e vê os mesmos projetos.</p><div class="rowb"><span class="cl-code">${esc(org.org.invite_code)}</span><button class="btn small" data-act="clcopy" data-v="${esc(org.org.invite_code)}">Copiar</button><button class="btn small" data-act="clrotate">Gerar novo código</button></div></fieldset>`:''}
  ${org?`<fieldset><legend>Equipe (${org.members.length})</legend>${org.members.map(m=>`<div class="cl-row"><div><b>${esc(m.name)}</b><small>${esc(m.email)} · ${m.role==='admin'?'administrador':'membro'}${m.last_login?' · último acesso '+fmtD(m.last_login):''}</small></div><div class="a">${C.user.role==='admin'&&m.id!==C.user.id?`<button class="btn small" data-act="clrole" data-v="${m.id}" data-w="${m.role==='admin'?'membro':'admin'}">${m.role==='admin'?'Tornar membro':'Tornar administrador'}</button><button class="btn small" data-act="clrm" data-v="${m.id}">Remover</button>`:''}</div></div>`).join('')}</fieldset>`:''}
  </div><div class="df"><button class="btn" data-act="cllogout">Sair da conta</button></div>`;if(!d.open)d.showModal()}

document.addEventListener('click',async e=>{const b=e.target.closest('[data-act]');if(!b||!C.user)return;const a=b.dataset.act;
  if(a==='cfg'&&b.closest('.mlist')&&/gerenciar/i.test(b.textContent)){e.stopImmediatePropagation();e.preventDefault();openProjects();return}
  if(a==='pjnew'&&b.closest('.mlist')&&b.textContent.includes('Confirmar')){setTimeout(()=>{if(state.cloudId){delete state.cloudId;delete state._cloudAt;save()}setStatus('ok','Projeto novo · ainda não salvo na nuvem')},50);return}
  if(!a.startsWith('cl'))return;e.stopImmediatePropagation();const v=b.dataset.v;
  try{switch(a){case 'clopen':openProjects();break;case 'clclose':dlg().close();break;case 'clsearch':openProjects($('#clQ').value.trim());break;
    case 'clnew':{const d=defaultState();d.v=2;d.brand=state.brand;loadProject(d);delete state.cloudId;save();dlg().close();say('Novo projeto criado. Use "Salvar projeto" para gravar na nuvem.');break}
    case 'clload':await loadCloud(v);break;case 'clhist':await history(v);break;case 'clback':renderProjects($('#clQ')?$('#clQ').value:'');break;
    case 'cldel':if(b.dataset.c!=='1'){b.dataset.c='1';b.textContent='Confirmar exclusão';return}await api('/projects/'+v,{method:'DELETE'});if(state.cloudId===v){delete state.cloudId;save()}await openProjects();say('Projeto excluído.');break;
    case 'clrestore':{const r=await api(`/projects/${v}/restore/${b.dataset.w}`,{method:'POST',body:{}});if(state.cloudId===v){await loadCloud(v)}else say('Versão restaurada.');break}
    case 'clup':{const p=PROJS[v];const data=JSON.parse(JSON.stringify(p.data));delete data.cloudId;await api('/projects',{method:'POST',body:{name:p.name,data}});say(`"${p.name}" enviado para a nuvem.`);await openProjects();break}
    case 'clacct':userMenu();break;case 'clcopy':navigator.clipboard&&navigator.clipboard.writeText(v);say('Código copiado.');break;
    case 'clrotate':await api('/org/invite/rotate',{method:'POST',body:{}});userMenu();break;
    case 'clrole':await api('/org/members/'+v,{method:'PUT',body:{role:b.dataset.w}});userMenu();break;
    case 'clrm':if(b.dataset.c!=='1'){b.dataset.c='1';b.textContent='Confirmar remoção';return}await api('/org/members/'+v,{method:'DELETE'});userMenu();break;
    case 'cllogout':await api('/auth/logout',{method:'POST',body:{}});C.applying=true;['qc-state-v1','qc-cloud-settings-at'].forEach(k=>rawRemove.call(localStorage,k));location.reload();break}}
  catch(err){say(err.message)}},true);

/* ---------- login / cadastro ---------- */
function gate(mode){C.user=null;let g=$('#clGate');if(!g){g=document.createElement('div');g.id='clGate';g.className='cl-gate';document.body.appendChild(g)}mode=mode||'login';
  g.innerHTML=`<form class="cl-card" id="clForm" novalidate><span class="brand" style="display:inline-grid">${typeof ICS!=='undefined'?ICS.bolt:''}</span><h2>Montador de painéis elétricos</h2><p>${mode==='login'?'Entre para acessar os projetos da sua empresa.':'Crie sua conta. Para entrar numa empresa existente, use o código de convite.'}</p>
  <div class="cl-tabs" role="tablist"><button type="button" role="tab" aria-selected="${mode==='login'}" data-m="login">Entrar</button><button type="button" role="tab" aria-selected="${mode==='reg'}" data-m="reg">Criar conta</button></div>
  ${mode==='reg'?'<label>Seu nome<input name="name" autocomplete="name" required></label>':''}
  <label>E-mail<input name="email" type="email" autocomplete="email" required></label>
  <label>Senha${mode==='reg'?' (mínimo 8 caracteres)':''}<input name="password" type="password" autocomplete="${mode==='login'?'current-password':'new-password'}" required minlength="8"></label>
  ${mode==='reg'?'<label>Nome da empresa (nova empresa)<input name="org_name" autocomplete="organization"></label><label>ou código de convite<input name="invite_code" autocomplete="off" style="text-transform:uppercase"></label>':''}
  <div class="cl-err" id="clErr" role="alert"></div><button class="btn primary block" type="submit">${mode==='login'?'Entrar':'Criar conta e entrar'}</button></form>`;
  g.querySelectorAll('[data-m]').forEach(x=>x.onclick=()=>gate(x.dataset.m));
  g.querySelector('#clForm').onsubmit=async ev=>{ev.preventDefault();const f=Object.fromEntries(new FormData(ev.target));const btn=ev.target.querySelector('[type=submit]');btn.disabled=true;$('#clErr').textContent='';
    try{const r=await api(mode==='login'?'/auth/login':'/auth/register',{method:'POST',body:f});C.user=r.user;await syncDown(true)}catch(e){$('#clErr').textContent=e.message;btn.disabled=false}};
  setTimeout(()=>{const i=g.querySelector('input');if(i)i.focus()},50)}

/* ---------- sincronização ao entrar ---------- */
function applySettingsLive(d){try{
  if('company' in d)COMP=d.company||{};if('logo' in d)LOGO=d.logo||'';if('logoApp' in d)LOGO_APP=d.logoApp||'';if('logoSame' in d)LOGO_SAME=d.logoSame==='1';
  if(d.theme&&typeof d.theme==='object'){THEME_SAVED={...THEME_DEF,...d.theme};THEME={...THEME_SAVED};applyTheme(THEME)}
  applyLogo();if(typeof updThemeBtn==='function')updThemeBtn();renderLeft();if(R)rebuild3D(true)}catch(e){console.warn('[nuvem] configurações',e)}}
async function syncDown(fromLogin){
  try{const s=await api('/settings');const at=localStorage.getItem('qc-cloud-settings-at')||'';
    if(s.updated_at&&Object.keys(s.data||{}).length&&(s.updated_at!==at||fromLogin)){C.applying=true;
      for(const [k,f] of Object.entries(SETKEYS)){if(!f||!(f in s.data))continue;const v=s.data[f];if(v===null)rawRemove.call(localStorage,k);else rawSet.call(localStorage,k,typeof v==='string'?v:JSON.stringify(v))}
      rawSet.call(localStorage,'qc-cloud-settings-at',s.updated_at);C.applying=false;applySettingsLive(s.data)}
    else if(!Object.keys(s.data||{}).length)pushSettings()}catch(e){C.applying=false}
  const last=C.user.prefs&&C.user.prefs.lastProject;
  if(last&&(!state||state.cloudId!==last)&&(fromLogin||!state.cloudId)){try{const r=await api('/projects/'+last);const data=r.data;data.cloudId=r.id;data._cloudAt=r.updated_at;C.applying=true;try{loadProject(data)}finally{C.applying=false}C.last=snap();rawSet.call(localStorage,'qc-state-v1',JSON.stringify(state))}catch(e){}}
  else if(fromLogin&&state&&state.cloudId){C.applying=true;delete state.cloudId;delete state._cloudAt;rawSet.call(localStorage,'qc-state-v1',JSON.stringify(state));C.applying=false}
  ready()}
function ready(){if(state&&state.cloudId&&!C.last)C.last=snap();const g=$('#clGate');if(g)g.remove();const hr=$('.hdr-r');if(hr&&!$('#clChip')){const chip=document.createElement('span');chip.id='clChip';chip.className='cl-chip';hr.prepend(chip);
    const ub=document.createElement('button');ub.className='btn small';ub.dataset.act='clacct';ub.innerHTML=(typeof ICS!=='undefined'?'<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>':'')+esc(C.user.name.split(' ')[0]);ub.title=`${C.user.name} · ${C.user.org.name}`;hr.appendChild(ub)}
  setStatus('ok',state&&state.cloudId?'Salvo na nuvem':'Projeto local · use "Salvar projeto"')}

/* ---------- início ---------- */
(async()=>{try{const r=await api('/me');C.user=r.user;await syncDown(false)}catch(e){if(e.status===401)gate();else{setStatus('err','Servidor indisponível');say('Servidor indisponível: trabalhando com os dados deste navegador.')}}})();
})();
