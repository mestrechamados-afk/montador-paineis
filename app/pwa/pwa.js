/* Instalação do Montador como aplicativo (ícone na área de trabalho / tela inicial). */
(function(){
'use strict';
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(e=>console.warn('[app] service worker',e)));
const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
const ua=navigator.userAgent,isIOS=/iphone|ipad|ipod/i.test(ua)||(/macintosh/i.test(ua)&&navigator.maxTouchPoints>1),isSafari=/^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);
let deferred=null;
const say=m=>{try{toast(m)}catch(e){alert(m)}};
function btn(){let b=document.getElementById('pwaBtn');if(b)return b;const hr=document.querySelector('.hdr-r');if(!hr)return null;b=document.createElement('button');b.id='pwaBtn';b.className='btn small primary';b.type='button';
  b.innerHTML='<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>Instalar app';b.title='Instalar o Montador como aplicativo neste dispositivo';b.onclick=install;hr.prepend(b);return b}
function show(on){const b=btn();if(b)b.hidden=!on}
async function install(){
  if(deferred){deferred.prompt();const r=await deferred.userChoice.catch(()=>({outcome:'dismissed'}));deferred=null;show(false);if(r.outcome==='accepted')say('Montador instalado! Procure o ícone na área de trabalho ou na tela inicial.');return}
  guide()}
function guide(){let d=document.getElementById('pwaDlg');if(!d){d=document.createElement('dialog');d.id='pwaDlg';d.className='dlg';document.body.appendChild(d)}
  const ios=isIOS,android=/android/i.test(ua);
  d.innerHTML=`<div class="dh"><h2>Instalar o Montador</h2><button class="x" aria-label="Fechar" onclick="this.closest('dialog').close()">×</button></div><div class="db" style="max-width:520px">
  <p style="display:flex;gap:12px;align-items:center"><img src="/icons/icon-192.png" alt="" width="56" height="56" style="border-radius:14px"> O app ganha um ícone próprio, abre em janela própria e continua usando os seus projetos da nuvem.</p>
  ${ios?`<ol><li>Abra este endereço no <b>Safari</b>.</li><li>Toque no botão <b>Compartilhar</b> (quadrado com seta para cima).</li><li>Toque em <b>Adicionar à Tela de Início</b> e depois em <b>Adicionar</b>.</li></ol>`
  :android?`<ol><li>No <b>Chrome</b>, toque no menu <b>⋮</b> (canto superior direito).</li><li>Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</li><li>Confirme em <b>Instalar</b>.</li></ol>`
  :`<ol><li>No <b>Chrome</b> ou <b>Edge</b>, clique no ícone de instalar na barra de endereço (computador com seta) ou no menu <b>⋮</b> / <b>…</b>.</li><li>Escolha <b>Instalar Montador</b> (no Edge: <b>Aplicativos › Instalar este site como aplicativo</b>).</li><li>O ícone aparece na área de trabalho e no menu Iniciar.</li></ol><p class="cap">No Safari para Mac: menu <b>Arquivo › Adicionar ao Dock</b>.</p>`}</div>
  <div class="df"><button class="btn primary" onclick="this.closest('dialog').close()">Entendi</button></div>`;d.showModal()}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;show(true)});
window.addEventListener('appinstalled',()=>{deferred=null;show(false)});
function boot(){if(/[?&]acao=importar/.test(location.search))setTimeout(()=>{try{if(window.CLOUD&&CLOUD.user)impOpen()}catch(e){}},2500);
  if(standalone()){show(false);return}
  // Safari (iOS/Mac) não dispara o evento de instalação: mostra o botão com as instruções
  if(isIOS||isSafari)show(true);else setTimeout(()=>{if(!deferred&&!standalone()){const b=btn();if(b){b.hidden=false;b.classList.remove('primary')}}},4000)}
if(document.readyState==='complete')boot();else window.addEventListener('load',boot);
window.MontadorInstall={install,guide};
})();
