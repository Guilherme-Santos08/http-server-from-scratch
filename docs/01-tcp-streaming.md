# Diagrama 1: TCP Streaming - O Problema Fundamental

## Como TCP entrega dados (não garante mensagens completas)

```mermaid
sequenceDiagram
    participant Cliente
    participant TCP
    participant EventData as socket.on("data")
    participant Servidor

    Note over Cliente: Cliente envia 2 requisições HTTP
    Cliente->>TCP: GET /user-agent HTTP/1.1\r\nHost: localhost\r\n\r\n
    Cliente->>TCP: GET /echo/abc HTTP/1.1\r\nHost: localhost\r\n\r\n

    Note over TCP: TCP fragmenta arbitrariamente em pacotes
    TCP->>EventData: Chunk 1: "GET /user"
    EventData->>Servidor: ❌ indexOf("\r\n\r\n") = -1
    Note over Servidor: SEM BUFFER: QUEBRA!

    TCP->>EventData: Chunk 2: "-agent HTTP/1.1\r\nHost: localhost\r\n\r\n"
    EventData->>Servidor: ✅ COM BUFFER: acumula dados
    Note over Servidor: Agora tem requisição completa!

    TCP->>EventData: Chunk 3: "GET /echo/abc HTTP/1.1\r\nHost: localhost\r\n\r\n"
    EventData->>Servidor: ✅ COM BUFFER: processa ambas requisições
    Note over Servidor: Loop processa cada uma
```

## O Problema

TCP é um **STREAM** (fluxo contínuo), não mensagens delimitadas.

- ❌ **Sem Buffer**: Assume que cada evento `data` contém uma requisição completa
- ✅ **Com Buffer**: Acumula dados até ter requisição(ões) completa(s)

## Solução

```typescript
// ❌ ERRADO - Código atual
socket.on("data", (data) => {
  const headerEndIndex = data.indexOf("\r\n\r\n");
  // Assume que 'data' tem requisição completa!
});

// ✅ CORRETO - Com buffer
let buffer = Buffer.alloc(0);
socket.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  // Acumula até ter requisição completa
});
```