# Diagrama 7: Múltiplas Conexões Simultâneas

## Sequência temporal com 2 clientes simultâneos

```mermaid
sequenceDiagram
    participant ClienteA
    participant ClienteB
    participant Servidor
    participant SocketA
    participant SocketB

    Note over Servidor: Servidor aguardando conexões<br/>na porta 4221

    ClienteA->>Servidor: TCP connect()
    Servidor->>SocketA: Cria novo socket A
    activate SocketA
    Note over SocketA: Closure criado:<br/>buffer_A = []<br/>reqCount_A = 0<br/>clientId = "::1:5001"

    ClienteB->>Servidor: TCP connect()
    Servidor->>SocketB: Cria novo socket B
    activate SocketB
    Note over SocketB: Closure criado:<br/>buffer_B = []<br/>reqCount_B = 0<br/>clientId = "::1:5002"

    ClienteA->>SocketA: GET /user-agent HTTP/1.1\r\n...
    Note over SocketA: buffer_A += chunk<br/>Processa requisição<br/>reqCount_A = 1
    SocketA-->>ClienteA: HTTP/1.1 200 OK\r\n...\r\ncurl/8.0

    ClienteB->>SocketB: GET /echo/abc HTTP/1.1\r\n...
    Note over SocketB: buffer_B += chunk<br/>Processa requisição<br/>reqCount_B = 1
    SocketB-->>ClienteB: HTTP/1.1 200 OK\r\n...\r\nabc

    ClienteA->>SocketA: GET /echo/xyz HTTP/1.1\r\n...
    Note over SocketA: buffer_A += chunk<br/>Processa requisição<br/>reqCount_A = 2
    SocketA-->>ClienteA: HTTP/1.1 200 OK\r\n...\r\nxyz

    Note over SocketA,SocketB: Estados completamente isolados!

    rect rgba(18, 15, 190, 1)
        Note over SocketA: 5 segundos sem atividade
        SocketA->>ClienteA: FIN (timeout)
        deactivate SocketA
        Note over SocketA: Conexão A fechada
    end

    ClienteB->>SocketB: GET /files/test.txt HTTP/1.1\r\n...
    Note over SocketB: buffer_B += chunk<br/>Processa requisição<br/>reqCount_B = 2
    SocketB-->>ClienteB: HTTP/1.1 200 OK\r\n...\r\n{file content}

    ClienteB->>SocketB: POST /files/new.txt HTTP/1.1\r\n...
    Note over SocketB: buffer_B += chunk<br/>Processa requisição<br/>reqCount_B = 3
    SocketB-->>ClienteB: HTTP/1.1 201 Created

    ClienteB->>Servidor: FIN (cliente fecha)
    SocketB->>ClienteB: ACK
    deactivate SocketB
    Note over SocketB: Conexão B fechada

    Note over Servidor: Servidor continua rodando,<br/>aguardando novas conexões
```

## Tabela de Estado ao Longo do Tempo

| Tempo | Conexão A                            | Conexão B                            | Event Loop    |
| ----- | ------------------------------------ | ------------------------------------ | ------------- |
| t0    | -                                    | -                                    | Aguardando    |
| t1    | Socket criado<br/>buffer=[], count=0 | -                                    | Ativo         |
| t2    | buffer=[...], count=0                | Socket criado<br/>buffer=[], count=0 | Ativo         |
| t3    | Processa req 1<br/>count=1           | buffer=[], count=0                   | Processando A |
| t4    | buffer=[], count=1                   | Processa req 1<br/>count=1           | Processando B |
| t5    | Processa req 2<br/>count=2           | buffer=[], count=1                   | Processando A |
| t6    | **TIMEOUT**<br/>Fechado              | buffer=[], count=1                   | Limpou A      |
| t7    | -                                    | Processa req 2<br/>count=2           | Processando B |
| t8    | -                                    | Processa req 3<br/>count=3           | Processando B |
| t9    | -                                    | **Fechado**                          | Limpou B      |

## Comparação: Código Atual vs Código Novo

### ❌ Código Atual (Funciona para 1 conexão por vez)

```typescript
// Já funciona para múltiplas conexões!
net.createServer((socket) => {
  // ✅ Cada socket tem seu escopo
  const clientId = `${socket.remoteAddress}:${socket.remotePort}`;

  socket.on("data", (data) => {
    // ❌ MAS não lida com fragmentação
    // ❌ MAS não processa múltiplas requisições no mesmo data
    processRequest(data);
  });
});
```

### ✅ Código Novo (Funciona para múltiplas conexões + requisições)

```typescript
net.createServer((socket) => {
  // ✅ Estado isolado por conexão
  let buffer = Buffer.alloc(0); // ← Único para esta conexão
  let requestCount = 0; // ← Único para esta conexão
  const clientId = `${socket.remoteAddress}:${socket.remotePort}`;

  socket.on("data", (chunk) => {
    // ✅ Acumula fragmentos
    buffer = Buffer.concat([buffer, chunk]);

    // ✅ Processa todas as requisições completas
    while (buffer.indexOf("\r\n\r\n") !== -1) {
      const request = extractRequest(buffer);
      processRequest(request);
      requestCount++;
      buffer = removeProcessed(buffer);
    }
  });
});
```

## Teste com curl --next

O comando que você mencionou testa exatamente isso:

```bash
curl --http1.1 -v \
  http://localhost:4221/user-agent \
  -H "User-Agent: orange/mango-grape" \
  --next \
  http://localhost:4221/echo/apple
```

O `--next` faz curl criar **2 conexões separadas**:

- **Conexão 1**: GET /user-agent
- **Conexão 2**: GET /echo/apple

Seu servidor precisa:

1. ✅ Aceitar ambas conexões simultaneamente
2. ✅ Processar cada uma independentemente
3. ✅ Manter estado separado (buffer, requestCount)
4. ✅ Responder corretamente para cada uma

## Conclusão

Node.js já fornece **isolamento de conexões** gratuitamente via closures.

O que precisamos adicionar:

1. **Buffer acumulativo** por conexão
2. **Loop** para processar múltiplas requisições
3. **Content-Length** para requisições POST
4. **Contador** para rastrear requisições por conexão
