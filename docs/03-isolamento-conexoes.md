# Diagrama 3: Isolamento de Estado Por Conexão

## Cada conexão tem seu próprio estado independente

```mermaid
graph TB
    subgraph Servidor["🖥️ Servidor Node.js (Event Loop)"]
        EventLoop[Event Loop - Single Thread]
    end

    subgraph ConexaoA["🔵 Conexão A (Socket A)<br/>127.0.0.1:5001"]
        BufferA["📦 buffer_A: Buffer.alloc(0)"]
        CountA["🔢 requestCount_A: 0"]
        ClientA["👤 clientId: '::1:5001'"]
        TimeoutA["⏱️ timeout: 5000ms"]
    end

    subgraph ConexaoB["🟢 Conexão B (Socket B)<br/>127.0.0.1:5002"]
        BufferB["📦 buffer_B: Buffer.alloc(0)"]
        CountB["🔢 requestCount_B: 0"]
        ClientB["👤 clientId: '::1:5002'"]
        TimeoutB["⏱️ timeout: 5000ms"]
    end

    subgraph ConexaoC["🔴 Conexão C (Socket C)<br/>127.0.0.1:5003"]
        BufferC["📦 buffer_C: Buffer.alloc(0)"]
        CountC["🔢 requestCount_C: 0"]
        ClientC["👤 clientId: '::1:5003'"]
        TimeoutC["⏱️ timeout: 5000ms"]
    end

    EventLoop -->|net.createServer callback 1| ConexaoA
    EventLoop -->|net.createServer callback 2| ConexaoB
    EventLoop -->|net.createServer callback 3| ConexaoC

    style ConexaoA fill:#90EE90,stroke:#2E7D32,stroke-width:3px
    style ConexaoB fill:#87CEEB,stroke:#1565C0,stroke-width:3px
    style ConexaoC fill:#FFB6C1,stroke:#C2185B,stroke-width:3px
    style Servidor fill:#FFF9C4,stroke:#F57F17,stroke-width:4px
```

## Por que isso funciona?

```typescript
// ✅ CORRETO - Estado isolado por conexão
const server = net.createServer((socket) => {
  // Cada execução deste callback cria um novo escopo!
  let buffer = Buffer.alloc(0);      // ← buffer_A, buffer_B, buffer_C...
  let requestCount = 0;               // ← count_A, count_B, count_C...
  const clientId = `${socket.remoteAddress}:${socket.remotePort}`;

  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);  // ← Cada um seu buffer!
    requestCount++;                           // ← Cada um seu contador!
  });
});
```

## ❌ ANTI-PATTERN - Estado Global (NUNCA FAÇA!)

```typescript
// ❌ ERRADO - Estado compartilhado
let buffer = Buffer.alloc(0);  // ← GLOBAL! PERIGO!
let requestCount = 0;          // ← GLOBAL! PERIGO!

const server = net.createServer((socket) => {
  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    // ❌ TODAS as conexões compartilham o mesmo buffer!
    // Cliente A pode receber dados do Cliente B!
  });
});
```

## Closure JavaScript Garante Isolamento

Cada chamada de `net.createServer(callback)` cria um **closure** novo com suas próprias variáveis locais.

```
Conexão 1 → Closure 1 { buffer_1, requestCount_1 }
Conexão 2 → Closure 2 { buffer_2, requestCount_2 }
Conexão 3 → Closure 3 { buffer_3, requestCount_3 }
```

Totalmente isolados! ✅