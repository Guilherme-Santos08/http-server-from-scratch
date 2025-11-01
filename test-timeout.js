import net from 'net';

console.log('🔌 Conectando ao servidor...');

const client = net.createConnection({ port: 4221, host: 'localhost' }, () => {
  console.log('✅ Conectado ao servidor!');
  console.log('📤 Enviando primeira requisição...\n');

  // Primeira requisição
  client.write('GET /echo/primeira HTTP/1.1\r\n');
  client.write('Connection: keep-alive\r\n');
  client.write('Host: localhost\r\n');
  client.write('\r\n');
});

let responseCount = 0;

client.on('data', (data) => {
  responseCount++;
  console.log(`📥 Resposta ${responseCount} recebida:`);
  console.log(data.toString());
  console.log('─'.repeat(50));

  if (responseCount === 1) {
    console.log('⏱️  Aguardando 3 segundos antes da segunda requisição...\n');

    setTimeout(() => {
      console.log('📤 Enviando segunda requisição...\n');
      client.write('GET /echo/segunda HTTP/1.1\r\n');
      client.write('Connection: keep-alive\r\n');
      client.write('Host: localhost\r\n');
      client.write('\r\n');
    }, 3000);
  } else if (responseCount === 2) {
    console.log('⏱️  Agora vou ficar INATIVO por 6 segundos...');
    console.log('⏱️  O timeout do servidor é 5s, então a conexão deve fechar!\n');

    // Não faz nada por 6 segundos
    // O servidor deve fechar a conexão por timeout
  }
});

client.on('end', () => {
  console.log('🔴 Servidor encerrou a conexão (FIN recebido)');
});

client.on('close', () => {
  console.log('🔴 Conexão fechada completamente');
  console.log('\n✅ Teste concluído!');
});

client.on('error', (err) => {
  console.error('❌ Erro:', err.message);
});

// Timeout de segurança (15 segundos)
setTimeout(() => {
  console.log('\n⚠️  Timeout do teste alcançado, fechando...');
  client.end();
}, 15000);
