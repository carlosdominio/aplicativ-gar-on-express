const axios = require('axios');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, 'garconnexpress', 'garconnexpress.db');
const db = new Database(dbPath);

async function debugDeliveredStatus() {
  const baseUrl = 'http://localhost:3001';
  
  try {
    console.log('--- DEBUG: STATUS ENTREGUE ---');
    const hash = await bcrypt.hash('123', 10);
    db.prepare('DELETE FROM garcons WHERE usuario = ?').run('teste');
    db.prepare('INSERT INTO garcons (nome, usuario, senha) VALUES (?, ?, ?)').run('Teste', 'teste', hash);
    
    db.prepare("UPDATE fluxo_caixa SET status = 'fechado'").run();
    db.prepare("INSERT INTO fluxo_caixa (valor_inicial, status) VALUES (?, 'aberto')").run(100);

    const resLogin = await axios.post(`${baseUrl}/api/login`, { usuario: 'teste', senha: '123' });
    const token = resLogin.data.token;
    const config = { headers: { Authorization: `Bearer ${token}` } };

    const mesa = db.prepare('SELECT * FROM mesas WHERE numero = 1').get();
    db.prepare("UPDATE mesas SET status = 'livre', garcom_id = NULL WHERE id = ?").run(mesa.id);
    const itemMenu = db.prepare('SELECT * FROM menu LIMIT 1').get();

    console.log('1. Criando Pedido...');
    await axios.post(`${baseUrl}/api/pedidos`, {
      mesa_id: mesa.id,
      garcom_id: 'teste',
      itens: [{ menu_id: itemMenu.id, preco: itemMenu.preco, quantidade: 1, observacao: 'Teste' }]
    }, config);

    const pedido = db.prepare("SELECT id FROM pedidos WHERE mesa_id = ? AND status != 'entregue'").get(mesa.id);
    console.log('ID do Pedido criado:', pedido.id);

    console.log('2. Marcando como Entregue...');
    const resDeliv = await axios.put(`${baseUrl}/api/pedidos/${pedido.id}/marcar-entregue`, { apenasProntos: false }, config);
    console.log('Resposta marcar-entregue:', resDeliv.data);

    console.log('3. Verificando Itens no DB...');
    const itens = db.prepare("SELECT * FROM pedido_itens WHERE pedido_id = ?").all(pedido.id);
    console.log('Itens:', JSON.stringify(itens, null, 2));

    console.log('4. Verificando Pedido no DB...');
    const pedidoDB = db.prepare("SELECT * FROM pedidos WHERE id = ?").get(pedido.id);
    console.log('Pedido:', JSON.stringify(pedidoDB, null, 2));

    console.log('5. Verificando Mesa via API...');
    const resMesa = await axios.get(`${baseUrl}/api/mesas`, config);
    const mesaData = resMesa.data.find(m => m.id === mesa.id);
    console.log('Mesa data:', JSON.stringify(mesaData, null, 2));

  } catch (error) {
    console.error('Erro no debug:', error.response ? error.response.data : error.message);
  }
}

debugDeliveredStatus();
