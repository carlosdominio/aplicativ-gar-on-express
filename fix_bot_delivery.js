const fs = require('fs');

const path = 'C:/Users/Admin/meu-zap-bot/index.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Corrigir o evento 'send_msg' para não depender do banco de dados para enviar
const sendMsgOld = /socket\.on\('send_msg', async \(data\) => \{[\s\S]*?const chatPath = `chats\.\$\{jid\}`;[\s\S]*?if \(!db\.has\(chatPath\)\.value\(\)\) return;[\s\S]*?const sent = await sock\.sendMessage\(jid, \{ text: data\.text \}\);[\s\S]*?\}\);/;
const sendMsgNew = `socket.on('send_msg', async (data) => {
        if (!sock || statusConexao !== "CONECTADO ✅") return;
        try {
            let jid = data.number;
            if (!jid.includes('@')) jid = jid.replace(/\\D/g, '') + '@s.whatsapp.net';
            
            // Envia a mensagem INDEPENDENTE de existir no banco de dados
            const sent = await sock.sendMessage(jid, { text: data.text });
            
            const msgObj = { 
                id: sent.key.id, 
                text: data.text, 
                fromMe: true, 
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
                sender: jid, 
                pushName: "Robô 🤖" 
            };
            
            // Salva no banco apenas para registro, mas envia primeiro
            await saveMessage(jid, msgObj, "Robô 🤖");
            io.emit('new_msg', msgObj);
        } catch (e) { console.log('Erro ao enviar mensagem:', e); }
    });`;

if (sendMsgOld.test(content)) {
    content = content.replace(sendMsgOld, sendMsgNew);
    console.log('Send Message logic updated to force delivery.');
} else {
    console.log('Send Message logic NOT found or already updated.');
}

// 2. Desativar o menu automático no index.js para evitar duplicidade com o server.js
// Vamos comentar a parte que envia o menu automático se a opção for 1, 2, 3, 4 ou 5
const menuAutoOld = /if \(!\['1', '2', '3', '4', '5'\]\.includes\(lowerText\)\) \{[\s\S]*?if \(reply\) \{[\s\S]*?await saveMessage\(jid, replyObj, pushName\);[\s\S]*?io\.emit\('new_msg', replyObj\);[\s\S]*?\}/;
// Apenas removemos o envio de 'reply' dentro do evento 'upsert' se for menu automático,
// pois o server.js já vai detectar o 'new_msg' via socket e responder.
// Na verdade, o server.js escuta o 'new_msg' do bot. Se o bot também responde, vira bagunça.
// Vou deixar o bot APENAS como ponte (gateway) e deixar a inteligência no server.js.

const upsertLogicOld = /sock\.ev\.on\('messages\.upsert', async \(m\) => \{[\s\S]*?if \(reply\) \{[\s\S]*?\}\s+else \{\s+\/\/ Envia o Menu Principal[\s\S]*?\}\s+\}\s+\}\);/;
// Vou substituir por uma versão que apenas emite para o socket e NÃO responde nada sozinha.
const upsertLogicNew = `sock.ev.on('messages.upsert', async (m) => {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const jid = msg.key.remoteJid;
            const pushName = msg.pushName || "Cliente";
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
            if (!text) return;

            console.log(\`📩 Mensagem de \${pushName} (\${jid}): \${text}\`);

            const msgObj = { 
                id: msg.key.id, 
                from: jid,
                text: text, 
                fromMe: false, 
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
                sender: jid, 
                pushName: pushName,
                body: text // Compatibilidade com server.js
            };

            await saveMessage(jid, msgObj, pushName);
            // EMITE para o server.js processar a inteligência do menu
            io.emit('new_msg', msgObj);
        });`;

// Nota: O server.js já tem a lógica de IF (msg === '1') etc.
// Ao remover do index.js, evitamos a duplicidade.

// Se não encontrar o padrão exato, vou tentar uma substituição mais genérica do bloco de mensagens
const msgBlockRegex = /sock\.ev\.on\('messages\.upsert'[\s\S]*?\}\s+\}\);\s+\} catch \(err\)/;
if (msgBlockRegex.test(content)) {
    content = content.replace(msgBlockRegex, upsertLogicNew + "\n        } catch (err)");
    console.log('Message Upsert logic simplified (intelligence moved to server.js).');
}

fs.writeFileSync(path, content, 'utf8');
console.log('Bot core updated.');
