const API_BASE_URL = 'https://garconnexpress.vercel.app'; // URL DO SEU SERVIDOR

let menu = [];
let mesas = [];
let timeoutPusher = null;
let configCozinhaCategorias = []; // Estado global das categorias da cozinha

// --- INTEGRAÇÃO CAPACITOR NATIVA ---
let isNativeApp = false;
try {
    isNativeApp = (window.Capacitor && window.Capacitor.isNativePlatform()) || 
                  window.location.protocol === 'capacitor:' || 
                  (window.location.protocol === 'http:' && window.location.hostname === 'localhost');
} catch(e) { console.error("Erro ao detectar ambiente:", e); }

document.addEventListener('DOMContentLoaded', async () => {
  console.log("🚀 App Iniciado");
  
  if (window.Capacitor && !isNativeApp) {
    isNativeApp = window.Capacitor.isNativePlatform();
  }
  
  if (isNativeApp) {
     document.body.classList.add('native-app');
     // Solicita notificações imediatamente se já estiver logado
     if (localStorage.getItem('garcom_token')) {
        registerNativePush().catch(e => console.error("Erro push inicial:", e));
     }
  }

  verificarSessao();
  atualizarInterfacePausa();
  
  // Ativa o Wake Lock no primeiro clique
  document.body.addEventListener('click', () => {
    if (typeof requestWakeLock === 'function') requestWakeLock();
  }, { once: true });
});

async function registerNativePush() {
  console.log("🔔 Solicitando registro de Notificações...");
  try {
    const { PushNotifications } = window.Capacitor.Plugins;
    if (!PushNotifications) return;

    // 1. Cria o Canal (Obrigatório para Android 8+)
    if (window.Capacitor.getPlatform() === 'android') {
      await PushNotifications.createChannel({
        id: 'pedidos',
        name: 'Alertas de Pedidos',
        description: 'Notificações de novos pedidos e chamados',
        sound: 'notificacao',
        importance: 5,
        visibility: 1,
        vibration: true
      });
    }

    // 2. Checa e solicita permissão (AQUI APARECE A JANELINHA)
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('❌ Permissão de notificação negada pelo usuário.');
      return;
    }

    // 3. Registra no FCM
    await PushNotifications.register();

    // 4. Listeners
    PushNotifications.addListener('registration', async (token) => {
      console.log('🔥 Token FCM recebido:', token.value);
      await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('garcom_token')
        },
        body: JSON.stringify({
          endpoint: token.value,
          keys: { p256dh: '', auth: '' },
          isNative: true
        })
      });
    });

    PushNotifications.addListener('pushNotificationReceived', async (notification) => {
      console.log('📩 Notificação recebida:', notification);
      try {
        const audio = new Audio('notificacao.mp3');
        await audio.play();
      } catch (e) {}
      if (typeof carregarMesas === 'function') carregarMesas();
    });

  } catch (error) {
    console.error('❌ Erro no Push Nativo:', error);
    if (error.message && !error.message.includes("is not implemented")) {
        alert("Erro nas notificações: " + error.message);
    }
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    let subscription = await reg.pushManager.getSubscription();
    
    if (!subscription) {
      const response = await fetch('/api/vapid-publicKey');
      const data = await response.json();
      const convertedVapidKey = urlBase64ToUint8Array(data.publicKey);
      
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });
    }
    
    await fetch('/api/subscribe', {
      method: 'POST',
      body: JSON.stringify(subscription),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('garcom_token')
      }
    });
    console.log('✅ Web Push ativado com sucesso!');
  } catch (error) {
    console.error('❌ Falha ao inscrever no Web Push:', error);
  }
}

let configCozinhaLoaded = false; // Flag para saber se já carregou do servidor

// Helper para travar/destravar o scroll do fundo de forma robusta
function atualizarBloqueioScroll() {
  const modais = ['.modal', '.modal-opcoes', '.modal-carrinho'];
  const algumAberto = modais.some(seletor => {
    const elementos = document.querySelectorAll(seletor);
    return Array.from(elementos).some(el => el.style.display !== 'none' && el.style.display !== '');
  });

  const screenFechado = document.getElementById('closed-screen');
  const estaFechado = screenFechado && screenFechado.style.display === 'flex';

  if (algumAberto || estaFechado) {
    document.body.classList.add('modal-open');
    document.documentElement.classList.add('modal-open');
  } else {
    document.body.classList.remove('modal-open');
    document.documentElement.classList.remove('modal-open');
  }
}

window.onerror = function(msg, url, line) {
  if (msg && typeof msg === 'string' && (msg.includes('WebSocket') || msg.includes('CLOSING') || msg.includes('CLOSED'))) {
    return true; // Suprime o erro
  }
};

const originalWarn = console.warn;
console.warn = function(...args) {
  const msg = args[0] ? (args[0].message || args[0].toString()) : '';
  if (typeof msg === 'string' && (msg.includes('WebSocket') || msg.includes('CLOSING') || msg.includes('CLOSED'))) return;
  originalWarn.apply(console, args);
};

const originalError = console.error;
console.error = function(...args) {
  const msg = args[0] ? (args[0].message || args[0].toString()) : '';
  if (typeof msg === 'string' && (msg.includes('WebSocket') || msg.includes('CLOSING') || msg.includes('CLOSED'))) return;
  originalError.apply(console, args);
};
// ---------------------------------------------------------

// Interceptador global para redirecionar ao login se a sessão expirar
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    let url = args[0];
    const token = localStorage.getItem('garcom_token');
    
    // Se for app nativo e a URL for interna, coloca a API_BASE_URL na frente
    if (isNativeApp && typeof url === 'string' && url.startsWith('/api/')) {
        url = API_BASE_URL + url;
        args[0] = url;
    }

    if (token) {
      if (!args[1]) args[1] = {};
      if (!args[1].headers) args[1].headers = {};
      args[1].headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await originalFetch(...args);

      if ((response.status === 401 || response.status === 403) && !args[0].includes('/api/login')) {
        console.warn("⚠️ Sessão expirada ou acesso negado (401/403).");
        
        localStorage.removeItem('garcom_logado');
        localStorage.removeItem('garcom_token');
        
        // Em vez de reload direto, avisa o usuário
        if (!isNativeApp) {
           window.location.reload();
        } else {
           const telaLogin = document.getElementById('tela-login');
           if (telaLogin) telaLogin.style.display = 'flex';
           alert("Sessão expirada. Por favor, faça login novamente.");
        }
      }
      return response;
    } catch (error) {
      console.error("❌ ERRO DE REDE/FETCH:", error, "URL:", args[0]);
      throw error;
    }
  };

let mesaAtual = null;
let pedidoAtual = [];
let pedidoAbertoNaMesa = null;
let garcomLogado = null;
let caixaAberto = false;
let categoriaAtual = sessionStorage.getItem('garcom_categoria_atual') || 'todas';
let garcomPausado = localStorage.getItem('garcom_pausado') === 'true';
let pusherInstancia = null; // Instância global do Pusher para reconexão

// --- WAKE LOCK API (Evita que a tela desligue) ---
let wakeLock = null;
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('🔒 Wake Lock ativado!');
    }
  } catch (err) {
    console.error(`❌ Erro Wake Lock: ${err.name}, ${err.message}`);
  }
}

// --- VISIBILITY SYNC (Reconexão ao voltar ao app) ---
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    requestWakeLock();
    carregarMesas();
    if (pusherInstancia && pusherInstancia.connection.state !== 'connected') {
      pusherInstancia.connect();
    }
  }
});

async function togglePausa() {
  if (!garcomLogado) return;
  
  const check = document.getElementById('check-pausa');
  garcomPausado = !check.checked;
  localStorage.setItem('garcom_pausado', garcomPausado);
  
  try {
    await fetch('/api/garcom/pausar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pausado: garcomPausado })
    });
    
    atualizarInterfacePausa();
  } catch (e) {
    console.error("Erro ao sincronizar pausa:", e);
  }
}

function atualizarInterfacePausa() {
  const check = document.getElementById('check-pausa');
  const label = document.getElementById('label-pausa');
  const slider = document.getElementById('slider-pausa');
  
  if (!check || !label) return;
  check.checked = !garcomPausado;
  
  if (garcomPausado) {
    label.textContent = 'PAUSADO';
    label.style.color = '#e67e22';
    if (slider) slider.style.backgroundColor = '#ccc';
  } else {
    label.textContent = 'NA FILA';
    label.style.color = '#2ecc71';
    if (slider) slider.style.backgroundColor = '#27ae60';
  }
}

function verificarSessao() {
  const salvo = localStorage.getItem('garcom_logado');
  if (salvo) {
    garcomLogado = JSON.parse(salvo);
    const telaLogin = document.getElementById('tela-login');
    if (telaLogin) telaLogin.style.display = 'none';
    const nomeExib = document.getElementById('garcom-nome-exibicao');
    if (nomeExib) nomeExib.textContent = `Garçom: ${garcomLogado.nome}`;
    iniciarApp();
  }
}

function mostrarAlerta(msg, titulo = "Aviso", icone = "🔔") {
  return new Promise(resolve => {
    document.getElementById('modal-sistema-icon').innerText = icone;
    document.getElementById('modal-sistema-titulo').innerText = titulo;
    document.getElementById('modal-sistema-mensagem').innerHTML = msg;
    document.getElementById('btn-sistema-cancelar').classList.add('hidden');
    document.getElementById('btn-sistema-confirmar').innerText = "OK";
    const modal = document.getElementById('modal-sistema');
    modal.style.display = 'flex';
    atualizarBloqueioScroll();
    document.getElementById('btn-sistema-confirmar').onclick = () => {
      modal.style.display = 'none';
      atualizarBloqueioScroll();
      resolve(true);
    };
  });
}

async function realizarLogin() {
  const btn = document.getElementById('btn-login');
  const usuario = document.getElementById('login-usuario').value;
  const senha = document.getElementById('login-senha').value;

  if (!usuario || !senha) return await mostrarAlerta("Preencha todos os campos", "Aviso", "⚠️");

  if (btn) {
    btn.classList.add('loading');
    btn.disabled = true;
  }

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, senha })
    });

    if (res.ok) {
      const data = await res.json();
      garcomLogado = data.garcom;
      localStorage.setItem('garcom_logado', JSON.stringify(garcomLogado));
      if (data.token) localStorage.setItem('garcom_token', data.token);

      const telaLogin = document.getElementById('tela-login');
      if (telaLogin) telaLogin.style.display = 'none';
      const nomeExib = document.getElementById('garcom-nome-exibicao');
      if (nomeExib) nomeExib.textContent = `Garçom: ${garcomLogado.nome}`;

      setTimeout(async () => {
          try {
              await iniciarApp();
              if (isNativeApp) await registerNativePush();
          } catch (e) { console.error("Erro pós-login:", e); }
      }, 500);
      
    } else {
      await mostrarAlerta("Usuário ou senha incorretos", "Erro de Login", "❌");
    }
  } catch (error) {
    console.error("Erro login:", error);
    await mostrarAlerta("Erro de conexão.", "Erro", "🌐");
  } finally {
    if (btn) {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  }
}

async function logout() {
  try { await fetch('/api/logout', { method: 'POST' }); } catch(e){}
  localStorage.removeItem('garcom_logado');
  localStorage.removeItem('garcom_token');
  location.reload();
}

async function iniciarApp() {
  const safeLoad = async (fn, name) => {
      try { await fn(); } catch(e) { console.error(`Falha ao carregar ${name}:`, e); }
  };

  await safeLoad(carregarConfigCozinha, "Configs Cozinha");
  await safeLoad(carregarMenu, "Menu");
  await safeLoad(carregarMesas, "Mesas");
  await safeLoad(atualizarStatusCaixa, "Status Caixa");
  
  try {
      atualizarIconeSom();
      configurarEventos();
      configurarPusher();
  } catch(e) { console.error("Erro em setup:", e); }

  if (window._timersIniciados) return;
  window._timersIniciados = true;
  setInterval(() => { try { exibirMesas(); } catch(e){} }, 1000);
  setInterval(() => { try { carregarMesas(); } catch(e){} }, 60000);
}

async function carregarConfigCozinha() {
    try {
        const res = await fetch('/api/config/categorias-cozinha');
        if (res.ok) {
            const cats = await res.json();
            configCozinhaCategorias = cats.map(c => c.trim().toUpperCase());
            configCozinhaLoaded = true;
        }
    } catch (e) { console.error("Erro configs cozinha:", e); }
}

async function carregarMenu() {
    const res = await fetch('/api/menu');
    if (!res.ok) return;
    menu = await res.json();
}

async function carregarMesas() {
  const res = await fetch('/api/mesas');
  if (!res.ok) return;
  mesas = await res.json();
  if (Array.isArray(mesas)) exibirMesas();
}

async function atualizarStatusCaixa() {
    try {
      const res = await fetch('/api/caixa/status');
      const caixa = await res.json();
      caixaAberto = !!caixa;
      const screenFechado = document.getElementById('closed-screen');
      if (screenFechado) screenFechado.style.display = !caixaAberto ? 'flex' : 'none';
      const badge = document.getElementById('caixa-status-badge');
      if (badge) {
          badge.style.display = 'block';
          badge.textContent = caixaAberto ? 'ABERTO' : 'FECHADO';
          badge.className = 'badge-caixa ' + (caixaAberto ? 'aberto' : 'fechado');
      }
    } catch (e) { console.error("Erro status caixa:", e); }
}

function filtrarMesas(tipo, btn) {
  filtroMesaAtual = tipo;
  document.querySelectorAll('.btn-filtro-mesa').forEach(b => b.classList.remove('ativa'));
  btn.classList.add('ativa');
  exibirMesas();
}

let filtroMesaAtual = 'todas';

function exibirMesas() {
    const grid = document.getElementById('mesas-grid');
    if (!grid || !Array.isArray(mesas)) return;

    let mesasExibidas = mesas;
    if (filtroMesaAtual === 'fechamentos') {
      mesasExibidas = mesas.filter(m => m.solicitou_fechamento || m.status === 'fechando');
    }

    grid.innerHTML = mesasExibidas.map(mesa => {
      let statusTexto = mesa.status.toUpperCase();
      let classeBloqueada = !caixaAberto ? 'caixa-fechado' : '';
      let cronometroHtml = '';

      if (caixaAberto && (mesa.status === 'ocupada' || mesa.status === 'fechando')) {
        const min = calcularMinutos(mesa.data_pedido);
        cronometroHtml = `<div class="cronometro">${min}m</div>`;
      }

      // IMPORTANTE: Mapeamento rigoroso das classes CSS para os estados da mesa
      const classeStatus = (mesa.status === 'ocupada' || mesa.status === 'fechando') ? 'ocupada' : 'livre';

      return `
        <div class="mesa ${classeStatus} ${classeBloqueada}" data-id="${mesa.id}">
          <h3>Mesa ${mesa.numero}</h3>
          <p>${statusTexto}</p>
          ${cronometroHtml}
          ${mesa.solicitou_fechamento ? '<div class="badge-fechamento">💰</div>' : ''}
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.mesa').forEach(mesaEl => {
      mesaEl.onclick = () => {
        if (!caixaAberto) {
          mostrarAlerta("O CAIXA ESTÁ FECHADO!", "Aviso", "⚠️");
          return;
        }
        const mesaSelecionada = mesas.find(m => m.id == mesaEl.dataset.id);
        mesaAtual = mesaSelecionada;
        mostrarOpcoesMesa(mesaSelecionada);
      };
    });
}

function calcularMinutos(dataIso) {
  if (!dataIso) return 0;
  const data = new Date(dataIso);
  const diffMs = new Date() - data;
  return Math.max(0, Math.floor(diffMs / 60000));
}

async function mostrarOpcoesMesa(mesa) {
    pedidoAbertoNaMesa = null;
    if (mesa.status === 'ocupada' || mesa.status === 'fechando') {
      try {
        const res = await fetch(`/api/pedidos/mesa/${mesa.id}`);  
        if (res.ok) pedidoAbertoNaMesa = await res.json();
      } catch (e) {}
    }

    document.getElementById('modal-mesa-titulo').textContent = `Mesa ${mesa.numero}`;
    document.getElementById('modal-opcoes').style.display = 'block';
    atualizarBloqueioScroll();
}

function fecharOpcoes() {
  document.getElementById('modal-opcoes').style.display = 'none';
  atualizarBloqueioScroll();
}

function abrirCardapioAdicionar() {
  fecharOpcoes();
  document.getElementById('mesas').classList.add('hidden');
  document.getElementById('pedido').classList.remove('hidden');
  document.getElementById('btn-header-mesas').style.display = 'flex';
  document.getElementById('mesa-atual').textContent = mesaAtual.numero;
  exibirMenu();
}

function voltarParaMesas() {
  document.getElementById('pedido').classList.add('hidden');
  document.getElementById('mesas').classList.remove('hidden');
  document.getElementById('btn-header-mesas').style.display = 'none';
  pedidoAtual = [];
  atualizarBadgeCarrinho();
}

async function exibirMenu(categoria = 'todas') {
    const grid = document.getElementById('menu-grid');
    if (!grid) return;
    
    const itens = categoria === 'todas' ? menu : menu.filter(item => item.categoria === categoria);
    
    grid.innerHTML = itens.map(item => `
      <div class="item-menu" onclick="adicionarAoPedido(${item.id})">
        <div class="item-nome">${item.nome}</div>
        <div class="item-preco">R$ ${item.preco.toFixed(2)}</div>
      </div>
    `).join('');
}

function adicionarAoPedido(id) {
  const item = menu.find(i => i.id === id);
  if (!item) return;
  const existente = pedidoAtual.find(p => p.menu_id === id);
  if (existente) existente.quantidade++;
  else pedidoAtual.push({ menu_id: id, nome: item.nome, preco: item.preco, quantidade: 1 });
  atualizarBadgeCarrinho();
}

function atualizarBadgeCarrinho() {
  const total = pedidoAtual.reduce((acc, p) => acc + p.quantidade, 0);
  const badge = document.getElementById('carrinho-badge');
  if (badge) badge.textContent = total;
}

function toggleCarrinho() {
  const modal = document.getElementById('modal-carrinho');
  const visivel = modal.style.display === 'block';
  modal.style.display = visivel ? 'none' : 'block';
  if (!visivel) renderizarCarrinho();
}

function renderizarCarrinho() {
  const container = document.getElementById('itens-pedido');
  container.innerHTML = pedidoAtual.map(p => `
    <div class="carrinho-item">
      <span>${p.nome} (x${p.quantidade})</span>
      <span>R$ ${(p.preco * p.quantidade).toFixed(2)}</span>
    </div>
  `).join('');
  const total = pedidoAtual.reduce((acc, p) => acc + (p.preco * p.quantidade), 0);
  document.getElementById('total-pedido').textContent = `Total: R$ ${total.toFixed(2)}`;
}

async function configurarPusher() {
    try {
      const configRes = await fetch('/api/pusher-config');
      const pusherConfig = await configRes.json();
      pusherInstancia = new Pusher(pusherConfig.key, { cluster: pusherConfig.cluster, forceTLS: true });
      const channel = pusherInstancia.subscribe('garconnexpress');
      channel.bind('novo-pedido', () => carregarMesas());
      channel.bind('chamado-garcom', (data) => alert("Chamado na mesa " + data.mesa_numero));
    } catch (e) { console.error("Erro Pusher:", e); }
}

function atualizarIconeSom() {}
function configurarEventos() {}
function alternarSom() {}
