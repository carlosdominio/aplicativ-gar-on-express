const fs = require('fs');
const path = 'C:\\Users\\Admin\\meu-zap-bot\\index.js';
let content = fs.readFileSync(path, 'utf8');

// Lógica para extrair o ID do pedido e atualizar o banco de dados do bot
const extractionLogic = `
                // IGNORAR MENSAGENS DE "NOVO PEDIDO" PARA EVITAR RESPOSTA AUTOMÁTICA DE MENU
                if (text.toUpperCase().includes('NOVO PEDIDO') || text.toUpperCase().includes('DELIVERY')) {
                    console.log('🚫 [Bot] Ignorando mensagem de pedido automático para não poluir o chat.');
                    
                    // EXTRAIR ID DO PEDIDO (Formato #1234)
                    const matchId = text.match(/#(\\d+)/);
                    const pedidoId = matchId ? matchId[1] : null;
                    
                    if (pedidoId) {
                        console.log(\`📦 [Bot] Identificado Pedido #\${pedidoId} para o JID \${jid}\`);
                        // Aqui o bot poderia salvar essa relação pedido <-> jid se necessário
                        if (db && chats[jid]) {
                            chats[jid].ultimoPedidoId = pedidoId;
                            chats[jid].atendimentoManual = true; // Garante modo humano ao receber pedido
                            await db.set('chats', { ...chats }).write();
                        }
                    }

                    const msgObjIgnore = {
                        id: msg.key.id,
                        from: jid,
                        text: text,
                        fromMe: fromMe,
                        time: new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }),
                        sender: jid,
                        pushName: pushName
                    };
                    await saveMessage(jid, msgObjIgnore, pushName);
                    io.emit('new_msg', msgObjIgnore);
                    return;
                }
`;

// Substitui o bloco de ignorar antigo pelo novo com extração de ID
const oldIgnoreBlock = /\/\/ IGNORAR MENSAGENS DE "NOVO PEDIDO"[\s\S]*?return;\s*\}/;
if (oldIgnoreBlock.test(content)) {
    content = content.replace(oldIgnoreBlock, extractionLogic);
    fs.writeFileSync(path, content);
    console.log('✅ Bot atualizado para localizar pedidos pelo ID (#)!');
} else {
    console.log('❌ Bloco de ignorar não encontrado no index.js do bot.');
}
