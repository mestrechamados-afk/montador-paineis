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
.cl-pw{display:flex;gap:6px}.cl-pw input{flex:1}.cl-eye{border:1px solid var(--line);background:var(--surface2);border-radius:8px;padding:0 10px;font-size:12.5px;cursor:pointer;color:var(--ink)}
.cl-caps{color:var(--warn);font-size:13px;font-weight:600;margin:-4px 0 6px}.cl-link{border:0;background:none;color:var(--neutral);text-decoration:underline;cursor:pointer;font-size:13.5px}
.cl-help{margin-top:10px;font-size:13px;line-height:1.45;background:var(--surface2);border:1px solid var(--line);border-radius:10px;padding:10px 12px}.cl-help ol{margin:6px 0 0;padding-left:18px}.cl-help li{margin-bottom:6px}.cl-help code{font-size:12px}
.cl-who{display:flex;flex-direction:column;gap:2px;padding:8px 10px 6px;font-size:12.5px;color:var(--muted)}.cl-who b{color:var(--ink);font-size:14px}
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
function pwDialog(){const d=dlg();const f=(id,lab,ac)=>`<label class="f"><span>${lab}</span><span class="cl-pw"><input type="password" id="${id}" autocomplete="${ac}" minlength="8"><button type="button" class="cl-eye" data-eye2 aria-label="Mostrar senha">Mostrar</button></span></label>`;
  d.innerHTML=`<div class="dh"><h2>Alterar senha</h2><button class="x" data-act="clclose" aria-label="Fechar">×</button></div><div class="db" style="max-width:440px">
  <p class="cap">Conta: <b>${esc(C.user.email)}</b></p>${f('clPa','Senha atual','current-password')}${f('clPb','Nova senha (mínimo 8 caracteres)','new-password')}${f('clPc','Repita a nova senha','new-password')}
  <p class="cl-caps" id="clCaps2" hidden>Caps Lock está ligado.</p><div class="cl-err" id="clPwErr" role="alert"></div></div>
  <div class="df"><button class="btn" data-act="clclose">Cancelar</button><button class="btn primary" data-act="clpwsave">Salvar nova senha</button></div>`;
  d.querySelectorAll('[data-eye2]').forEach(x=>x.onclick=()=>{const i=x.previousElementSibling;const sh=i.type==='password';i.type=sh?'text':'password';x.textContent=sh?'Ocultar':'Mostrar'});
  d.onkeyup=ev=>{const c=$('#clCaps2');if(c&&ev.getModifierState)c.hidden=!ev.getModifierState('CapsLock');if(ev.key==='Enter'&&ev.target.tagName==='INPUT'){const b=d.querySelector('[data-act=clpwsave]');if(b)b.click()}};
  if(!d.open)d.showModal();setTimeout(()=>{const i=$('#clPa');if(i)i.focus()},50)}
async function userMenu(){const d=dlg();let org=null;try{org=await api('/org')}catch(e){}
  d.innerHTML=`<div class="dh"><h2>Conta</h2><button class="x" data-act="clclose" aria-label="Fechar">×</button></div><div class="db">
  <fieldset><legend>Você</legend><p style="margin:4px 0"><b>${esc(C.user.name)}</b> · ${esc(C.user.email)}</p><p class="cap" style="margin:0 0 8px">Perfil: ${C.user.role==='admin'?'administrador':'membro'} · Empresa: ${esc(C.user.org.name)}</p>
    <div class="g2"><label class="f"><span>Senha atual</span><input type="password" id="clPwCur" autocomplete="current-password"></label><label class="f"><span>Nova senha (mín. 8)</span><input type="password" id="clPwNew" autocomplete="new-password"></label></div><button class="btn small" data-act="clpw">Trocar senha</button></fieldset>
  ${org&&org.org.invite_code?`<fieldset><legend>Convidar a equipe</legend><p class="cap">Quem criar conta com este código entra na sua empresa e vê os mesmos projetos.</p><div class="rowb"><span class="cl-code">${esc(org.org.invite_code)}</span><button class="btn small" data-act="clcopy" data-v="${esc(org.org.invite_code)}">Copiar</button><button class="btn small" data-act="clrotate">Gerar novo código</button></div></fieldset>`:''}
  ${org?`<fieldset><legend>Equipe (${org.members.length})</legend>${org.members.map(m=>`<div class="cl-row"><div><b>${esc(m.name)}</b><small>${esc(m.email)} · ${m.role==='admin'?'administrador':'membro'}${m.last_login?' · último acesso '+fmtD(m.last_login):''}</small></div><div class="a">${C.user.role==='admin'&&m.id!==C.user.id?`<button class="btn small" data-act="clreset" data-v="${m.id}" data-w="${esc(m.name)}">Gerar senha provisória</button><button class="btn small" data-act="clrole" data-v="${m.id}" data-w="${m.role==='admin'?'membro':'admin'}">${m.role==='admin'?'Tornar membro':'Tornar administrador'}</button><button class="btn small" data-act="clrm" data-v="${m.id}">Remover</button>`:''}</div></div>`).join('')}</fieldset>`:''}
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
    case 'clpwdlg':pwDialog();break;
    case 'clpwsave':{const a1=$('#clPa').value,b1=$('#clPb').value,c1=$('#clPc').value,er=$('#clPwErr');er.textContent='';
      if(!a1){er.textContent='Digite a senha atual.';return}if(b1.length<8){er.textContent='A nova senha precisa ter pelo menos 8 caracteres.';return}if(b1!==c1){er.textContent='As duas novas senhas não são iguais.';return}if(b1===a1){er.textContent='A nova senha precisa ser diferente da atual.';return}
      b.disabled=true;try{await api('/me/password',{method:'PUT',body:{current:a1,password:b1}});dlg().close();say('Senha alterada. Use a nova senha no próximo acesso.')}catch(err){er.textContent=err.message}finally{b.disabled=false}break}
    case 'clpw':{const cur=$('#clPwCur').value,nw=$('#clPwNew').value;await api('/me/password',{method:'PUT',body:{current:cur,password:nw}});$('#clPwCur').value='';$('#clPwNew').value='';say('Senha alterada.');break}
    case 'clreset':{if(b.dataset.c!=='1'){b.dataset.c='1';b.textContent='Confirmar: gerar senha';return}const r=await api(`/org/members/${v}/reset-password`,{method:'POST',body:{}});b.dataset.c='';
      b.outerHTML=`<span class="cl-code" title="Senha provisória">${esc(r.temp_password)}</span>`;say(`Senha provisória de ${b.dataset.w} gerada. Envie para a pessoa e peça que troque ao entrar.`);break}
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
  <label>Senha${mode==='reg'?' (mínimo 8 caracteres)':''}<span class="cl-pw"><input name="password" type="password" autocomplete="${mode==='login'?'current-password':'new-password'}" required minlength="8"><button type="button" class="cl-eye" data-eye aria-label="Mostrar senha">Mostrar</button></span></label>
  ${mode==='reg'?'<label>Repita a senha<span class="cl-pw"><input name="password2" type="password" autocomplete="new-password" required minlength="8"><button type="button" class="cl-eye" data-eye aria-label="Mostrar senha">Mostrar</button></span></label>':''}
  <p class="cl-caps" id="clCaps" hidden>Caps Lock está ligado.</p>
  ${mode==='reg'?'<label>Nome da empresa (nova empresa)<input name="org_name" autocomplete="organization"></label><label>ou código de convite<input name="invite_code" autocomplete="off" style="text-transform:uppercase"></label>':''}
  <div class="cl-err" id="clErr" role="alert"></div><button class="btn primary block" type="submit">${mode==='login'?'Entrar':'Criar conta e entrar'}</button>
  ${mode==='login'?'<p style="margin:12px 0 0;text-align:center"><button type="button" class="cl-link" data-forgot>Esqueci minha senha</button></p><div class="cl-help" id="clHelp" hidden><b>Como recuperar o acesso</b><ol><li><b>Se outra pessoa da empresa é administradora:</b> peça para ela entrar, clicar no nome dela no topo › <i>Equipe</i> › <i>Gerar senha provisória</i> ao lado do seu nome. Entre com essa senha e troque-a em seguida no seu menu de conta.</li><li><b>Se você é o único administrador:</b> no painel do servidor (por exemplo, Render › seu serviço › <i>Environment</i>), crie as variáveis <code>RESET_PASSWORD_EMAIL</code> (seu e-mail) e <code>RESET_PASSWORD_NEW</code> (a nova senha, mínimo 8 caracteres) e salve. Depois que o serviço reiniciar, entre com a nova senha e <b>apague as duas variáveis</b>.</li></ol></div>':''}</form>`;
  g.querySelectorAll('[data-m]').forEach(x=>x.onclick=()=>gate(x.dataset.m));
  g.querySelectorAll('[data-eye]').forEach(x=>x.onclick=()=>{const i=x.previousElementSibling;const show=i.type==='password';i.type=show?'text':'password';x.textContent=show?'Ocultar':'Mostrar';x.setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha')});
  const fg=g.querySelector('[data-forgot]');if(fg)fg.onclick=()=>{const h=$('#clHelp');h.hidden=!h.hidden};
  g.addEventListener('keyup',ev=>{if(ev.getModifierState){const c=$('#clCaps');if(c)c.hidden=!ev.getModifierState('CapsLock')}});
  g.querySelector('#clForm').onsubmit=async ev=>{ev.preventDefault();const f=Object.fromEntries(new FormData(ev.target));const btn=ev.target.querySelector('[type=submit]');btn.disabled=true;$('#clErr').textContent='';
    if(mode==='reg'&&f.password!==f.password2){$('#clErr').textContent='As senhas digitadas não são iguais.';btn.disabled=false;return}delete f.password2;f.email=(f.email||'').trim();
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
    const ui='<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',chev=(typeof ICS!=='undefined'?ICS.chev:'▾');
    const m=document.createElement('div');m.className='menu';m.id='clUserMenu';
    m.innerHTML=`<button class="btn small mbtn" data-menu aria-haspopup="menu" aria-expanded="false" title="${esc(C.user.name)} · ${esc(C.user.org.name)}">${ui}${esc(C.user.name.split(' ')[0])}${chev}</button>
      <div class="mlist right" role="menu" hidden><div class="cl-who"><b>${esc(C.user.name)}</b><span>${esc(C.user.email)}</span><span>${esc(C.user.org.name)} · ${C.user.role==='admin'?'administrador':'membro'}</span></div><hr>
      <button role="menuitem" data-act="clpwdlg"><svg class="ic" viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>Alterar senha</button>
      <button role="menuitem" data-act="clacct"><svg class="ic" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/></svg>Conta e equipe…</button><hr>
      <button role="menuitem" data-act="cllogout"><svg class="ic" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></svg>Sair da conta</button></div>`;hr.appendChild(m)}
  setStatus('ok',state&&state.cloudId?'Salvo na nuvem':'Projeto local · use "Salvar projeto"')}

/* ---------- início ---------- */
(async()=>{try{const r=await api('/me');C.user=r.user;await syncDown(false)}catch(e){if(e.status===401)gate();else{setStatus('err','Servidor indisponível');say('Servidor indisponível: trabalhando com os dados deste navegador.')}}})();
})();
