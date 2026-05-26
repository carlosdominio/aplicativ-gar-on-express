const fs = require('fs');

const path = 'C:/Users/Admin/meu-zap-bot/index.js';
let content = fs.readFileSync(path, 'utf8');

// Voltando a inteligência para o Bot, mas de forma limpa e sem duplicidade.
const upsertLogicUnified = `sock.ev.on('messages.upsert', async (m) => {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const jid = msg.key.remoteJid;
            const from = jid.split('@')[0].replace(/\\D/g, '');
            const pushName = msg.pushName || "Cliente";
            const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
            if (!text) return;

            console.log(\`📩 Mensagem de \${pushName} (\${from}): \${text}\`);

            const msgObj = { 
                id: msg.key.id, 
                from: jid,
                text: text, 
                fromMe: false, 
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
                sender: jid, 
                pushName: pushName,
                body: text
            };

            await saveMessage(jid, msgObj, pushName);
            io.emit('new_msg', msgObj);

            // INTELIGÊNCIA DO MENU (DENTRO DO BOT PARA RESPOSTA INSTANTÂNEA)
            let reply = "";
            const lowerText = text.toLowerCase();

            if (!['1', '2', '3', '4', '5'].includes(lowerText)) {
                reply = \`Olá \${pushName}! 👋 Seja bem-vindo ao *GuGA Bebidas*.\n\nComo posso te ajudar hoje?\n\n1️⃣ - Ver Cardápio Digital 📖\n2️⃣ - Fazer um Pedido 🛒\n3️⃣ - Promoções do Dia 🔥\n4️⃣ - Endereço e Horário 📍\n5️⃣ - Falar com o Atendente 👨‍💻\n\n_Digite apenas o número da opção desejada._\`;
            } else {
                if (lowerText === '1') {
                    reply = "📖 *CARDÁDIO DIGITAL*\\n\\nVocê pode ver todos os nossos itens e preços clicando no link abaixo:\\nhttps://garconnexpress.vercel.app/cardapio/\\n\\n_(Escolha o que deseja e nos mande o pedido por aqui!)_";
                } else if (lowerText === '2') {
                    reply = "🛒 *COMO FAZER UM PEDIDO*\\n\\nÉ muito simples:\\n1. Veja o cardápio (opção 1)\\n2. Escreva aqui o que deseja (ex: 2 Cervejas, 1 Porção de Batata)\\n3. Confirme seu endereço\\n\\n*Um atendente irá confirmar seu pedido em instantes!*";
                } else if (lowerText === '3') {
                    try {
                        const response = await fetch('https://garconnexpress.vercel.app/api/menu');
                        const menu = await response.json();
                        const promos = menu.filter(item => item.em_promocao && (item.visivel === true || item.visivel === 1));
                        let promoMsg = "🔥 *PROMOÇÕES DO DIA*\\n\\n";
                        if (promos.length > 0) {
                            promos.forEach(p => {
                                const precoOriginal = p.preco_original ? \`~R$ \${parseFloat(p.preco_original).toFixed(2)}~ \` : "";
                                promoMsg += \`✅ *\${p.nome}*\\n💰 \${precoOriginal}*R$ \${parseFloat(p.preco).toFixed(2)}*\\n\\n\`;
                            });
                            promoMsg += "_Aproveite que é por tempo limitado!_";
                        } else {
                            promoMsg += "No momento não temos promoções ativas, mas fique de olho no nosso cardápio! 😉";
                        }
                        reply = promoMsg;
                    } catch (e) {
                        reply = "🔥 *PROMOÇÕES DO DIA*\\n\\nNo momento não conseguimos carregar as promoções. Por favor, tente novamente em instantes ou veja no nosso cardápio digital!";
                    }
                } else if (lowerText === '4') {
                    reply = "📍 *ENDEREÇO E HORÁRIO*\\n\\n🏠 Endereço: rua democrito gracindo 132 ponta grossa\\n⏰ Horário: Diariamente das 18h às 02:00";
                } else if (lowerText === '5') {
                    reply = "👨‍💻 *ATENDIMENTO HUMANO*\\n\\nAguarde um momento. Um atendente humano já foi notificado e irá falar com você em breve!";
                    await db.set(\`chats.\${jid}.atendimentoManual\`, true).write();
                    io.emit('status_atendimento', { jid, atendimentoManual: true });
                }
            }

            if (reply) {
                const sentReply = await sock.sendMessage(jid, { text: reply });
                const replyObj = { id: sentReply.key.id, text: reply, fromMe: true, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), sender: jid, pushName: "Robô 🤖" };
                await saveMessage(jid, replyObj, pushName);
                io.emit('new_msg', replyObj);
            }
        });`;

const msgBlockRegex = /sock\.ev\.on\('messages\.upsert'[\s\S]*?io\.emit\('new_msg', msgObj\);\s+?\}\);/;
if (msgBlockRegex.test(content)) {
    content = content.replace(msgBlockRegex, upsertLogicUnified);
    console.log('Intelligence restored to Bot index.js.');
} else {
    console.log('Target block for restoration NOT found.');
}

fs.writeFileSync(path, content, 'utf8');
console.log('Restore complete.');
