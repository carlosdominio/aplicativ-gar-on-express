const fs = require('fs');

const path = 'C:/Users/Admin/meu-zap-bot/index.js';
let content = fs.readFileSync(path, 'utf8');

// Main Menu
const mainMenuOld = /reply = `Olá \$\{pushName\}! 👋 Seja bem-vindo ao \*GuGA Bebidas\*[\s\S]*?_Digite apenas o número da opção desejada\._`;/;
const mainMenuNew = 'reply = `Olá ${pushName}! 👋 Seja bem-vindo ao *GuGA Bebidas*.\n\nComo posso te ajudar hoje?\n\n1️⃣ - Ver Cardápio Digital 📖\n2️⃣ - Fazer um Pedido 🛒\n3️⃣ - Promoções do Dia 🔥\n4️⃣ - Endereço e Horário 📍\n5️⃣ - Falar com o Atendente 👨‍💻\n\n_Digite apenas o número da opção desejada._`;';
if (mainMenuOld.test(content)) {
    content = content.replace(mainMenuOld, mainMenuNew);
    console.log('Main Menu updated');
} else {
    console.log('Main Menu NOT found');
}

// Option 1
const opt1Old = /if \(lowerText === '1'\) \{[\s\S]*?reply = "📖 \*CARDÁPIO DIGITAL\*[\s\S]*?https:\/\/garconnexpress\.vercel\.app\/[\s\S]*?";/;
const opt1New = `if (lowerText === '1') {
                    reply = "📖 *CARDÁPIO DIGITAL*\\n\\nVocê pode ver todos os nossos itens e preços clicando no link abaixo:\\nhttps://garconnexpress.vercel.app/cardapio/\\n\\n_(Escolha o que deseja e nos mande o pedido por aqui!)_";`;
if (opt1Old.test(content)) {
    content = content.replace(opt1Old, opt1New);
    console.log('Option 1 updated');
} else {
    console.log('Option 1 NOT found');
}

// Option 3
const opt3Old = /\} else if \(lowerText === '3'\) \{[\s\S]*?reply = "🔥 \*PROMOÇÕES DO DIA\*[\s\S]*?";/;
const opt3New = `} else if (lowerText === '3') {
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
                    }`;
if (opt3Old.test(content)) {
    content = content.replace(opt3Old, opt3New);
    console.log('Option 3 updated');
} else {
    console.log('Option 3 NOT found');
}

// Option 4
const opt4Old = /\} else if \(lowerText === '4'\) \{[\s\S]*?reply = "📍 \*ONDE ESTAMOS E HORÁRIO\*[\s\S]*?";/;
const opt4New = `} else if (lowerText === '4') {
                    reply = "📍 *ENDEREÇO E HORÁRIO*\\n\\n🏠 Endereço: rua democrito gracindo 132 ponta grossa\\n⏰ Horário: Diariamente das 18h às 02:00";`;
if (opt4Old.test(content)) {
    content = content.replace(opt4Old, opt4New);
    console.log('Option 4 updated');
} else {
    console.log('Option 4 NOT found');
}

fs.writeFileSync(path, content, 'utf8');
console.log('Write complete');
