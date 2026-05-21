const axios = require('axios');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, 'garconnexpress', 'garconnexpress.db');
const db = new Database(dbPath);

async function testTimerRemoval() {
  const baseUrl = 'http://localhost:3001';
  
  try {
    console.log('--- 1. Preparando Ambiente ---');
    const hash = await bcrypt.hash('123', 10);
    db.prepare('DELETE FROM garcons WHERE usuario = ?').run('teste');
    db.prepare('INSERT INTO garcons (nome, usuario, senha) VALUES (?, ?, ?)').run('Teste', 'teste', hash);
    
    // Abre caixa - corrigindo aspas simples para strings no SQLite
    db.prepare("UPDATE fluxo_caixa SET status = 'fechado'").run();
    db.prepare("INSERT INTO fluxo_caixa (valor_inicial, status) VALUES (?, 'aberto')").run(100);

    // Login
    const resLogin = await axios.post(`${baseUrl}/api/login`, { usuario: 'teste', senha: '123' });
    const token = resLogin.data.token;
    const config = { headers: { Authorization: `Bearer ${token}` } };

    // Pegar Mesa e Produto
    const mesa = db.prepare('SELECT * FROM mesas WHERE numero = 1').get();
    db.prepare("UPDATE mesas SET status = 'livre', garcom_id = NULL WHERE id = ?").run(mesa.id);
    const itemMenu = db.prepare('SELECT * FROM menu LIMIT 1').get();

    console.log('--- 2. Criando Pedido na Mesa 1 ---');
    await axios.post(`${baseUrl}/api/pedidos`, {
      mesa_id: mesa.id,
      garcom_id: 'teste',
      itens: [{ menu_id: itemMenu.id, preco: itemMenu.preco, quantidade: 1, observacao: 'Teste' }]
    }, config);

    let resMesa = await axios.get(`${baseUrl}/api/mesas`, config);
    let mesaData = resMesa.data.find(m => m.id === mesa.id);
    console.log('Status após pedido:', mesaData.status);
    console.log('Pedido Status:', mesaData.pedido_status);

    console.log('--- 3. Marcando Pedido como Entregue ---');
    // Busca o pedido que acabamos de criar
    const pedido = db.prepare("SELECT id FROM pedidos WHERE mesa_id = ? AND status != 'entregue'").get(mesa.id);
    await axios.put(`${baseUrl}/api/pedidos/${pedido.id}/marcar-entregue`, { apenasProntos: false }, config);

    console.log('--- 4. Verificando Status Final ---');
    resMesa = await axios.get(`${baseUrl}/api/mesas`, config);
    mesaData = resMesa.data.find(m => m.id === mesa.id);
    
    console.log('Status Mesa:', mesaData.status);
    console.log('Pedido Status:', mesaData.pedido_status);
    
    const possuiCronometroVisual = !!mesaData.pedido_created_at && mesaData.pedido_status !== 'servido';
    console.log('Possui cronômetro (visual)?', possuiCronometroVisual);

    if (mesaData.status === 'ocupada' && mesaData.pedido_status === 'servido' && !possuiCronometroVisual) {
      console.log('✅ SUCESSO: Mesa ocupada, pedido servido e cronômetro oculto!');
    } else {
      console.log('❌ FALHA: O cronômetro ainda apareceria ou o status está errado.');
      console.log('Data:', JSON.stringify(mesaData, null, 2));
    }

  } catch (error) {
    console.error('Erro no teste:', error.response ? error.response.data : error.message);
  }
}

testTimerRemoval();
