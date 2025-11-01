# Diagrama 4: Processamento com Buffer e Loop

## Fluxograma do algoritmo de parsing

```mermaid
flowchart TD
    Start([socket.on data recebe chunk]) --> Concat[buffer = Buffer.concat buffer, chunk]

    Concat --> WhileLoop{buffer.indexOf<br/>\r\n\r\n != -1?}

    WhileLoop -->|NÃO<br/>Requisição incompleta| End([Aguarda mais dados])
    WhileLoop -->|SIM<br/>Tem headers completos| Extract[headerEndIndex = buffer.indexOf \r\n\r\n]

    Extract --> HasBody{Parseia headers<br/>Tem Content-Length?}

    HasBody -->|NÃO<br/>GET, DELETE, etc| ProcessNoBody[totalLength = headerEndIndex + 4]
    HasBody -->|SIM<br/>POST, PUT| CalcBody[contentLength = parseInt header<br/>totalLength = headerEndIndex + 4 + contentLength]

    ProcessNoBody --> CheckComplete{buffer.length >= totalLength?}
    CalcBody --> CheckComplete

    CheckComplete -->|NÃO<br/>Body incompleto| End
    CheckComplete -->|SIM<br/>Requisição completa| ExtractReq[request = buffer.subarray 0, totalLength]

    ExtractReq --> Process[Processar Requisição<br/>Parse método, path, headers]

    Process --> Increment[requestCount++]
    Increment --> SendResponse[Enviar Resposta HTTP]
    SendResponse --> RemoveBuffer[buffer = buffer.subarray totalLength]
    RemoveBuffer --> WhileLoop
```

## Por que o WHILE é crucial?

Um único evento `data` pode conter **múltiplas requisições completas**:

```
Chunk recebido:
"GET /echo/abc HTTP/1.1\r\nHost: localhost\r\n\r\nGET /user-agent HTTP/1.1\r\nHost: localhost\r\n\r\n"
│←──────────────── Req 1 ────────────────→│←──────────────── Req 2 ────────────────→│
```

### ❌ Sem Loop (processa apenas 1x)

```typescript
socket.on("data", (data) => {
  const index = data.indexOf("\r\n\r\n");
  if (index !== -1) {
    processRequest(data); // ← Processa só primeira!
  }
  // ❌ Segunda requisição PERDIDA!
});
```

### ✅ Com Loop (processa todas)

```typescript
socket.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);

  while (buffer.indexOf("\r\n\r\n") !== -1) {
    // ← LOOP!
    // Extrai e processa
    const request = extractRequest(buffer);
    processRequest(request);
    buffer = removeProcessed(buffer);
  }
  // ✅ Todas requisições processadas!
});
```

## Exemplo Prático

```
Estado inicial:
buffer = []

Evento 1: chunk = "GET /echo/abc HTTP/1.1\r\nHost: localhost\r\n\r\nGET /user-agent HTTP/1.1\r\nHost: localhost\r\n\r\n"

buffer = [chunk]

Loop iteração 1:
  indexOf("\r\n\r\n") = 42 ✓
  Extrai: "GET /echo/abc HTTP/1.1\r\nHost: localhost\r\n\r\n"
  Processa e responde
  buffer = "GET /user-agent HTTP/1.1\r\nHost: localhost\r\n\r\n"

Loop iteração 2:
  indexOf("\r\n\r\n") = 46 ✓
  Extrai: "GET /user-agent HTTP/1.1\r\nHost: localhost\r\n\r\n"
  Processa e responde
  buffer = []

Loop iteração 3:
  indexOf("\r\n\r\n") = -1
  Sai do while

✓ Ambas requisições processadas!
```
