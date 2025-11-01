# Diagrama 6: POST com Content-Length

## Fluxograma para requisições com body

```mermaid
flowchart TD
    Start([Chunk recebido]) --> AddBuffer[buffer += chunk]

    AddBuffer --> FindHeader{indexOf \r\n\r\n >= 0?}
    FindHeader -->|NÃO<br/>Headers incompletos| Wait([Aguarda mais dados])
    FindHeader -->|SIM<br/>Headers completos| ParseHeader[Parse headers do buffer]

    ParseHeader --> CheckCL{Tem Content-Length?}

    CheckCL -->|NÃO<br/>GET, HEAD, etc| CalcNoBody[totalLength = headerEnd + 4]
    CheckCL -->|SIM<br/>POST, PUT, PATCH| ExtractCL[contentLength = parseInt header Content-Length]

    ExtractCL --> CalcWithBody[totalLength = headerEnd + 4 + contentLength]

    CalcNoBody --> Compare{buffer.length >= totalLength?}
    CalcWithBody --> Compare

    Compare -->|NÃO<br/>Faltam bytes do body| Wait
    Compare -->|SIM<br/>Requisição completa| Extract[headers = buffer.subarray 0, headerEnd<br/>body = buffer.subarray headerEnd+4, totalLength]

    Extract --> Process[Processa requisição<br/>com headers e body]
    Process --> Respond[Envia resposta HTTP]
    Respond --> Remove[buffer = buffer.subarray totalLength]
    Remove --> Loop{Mais dados<br/>no buffer?}

    Loop -->|SIM| FindHeader
    Loop -->|NÃO| End([Fim do evento data])

```

## Exemplo: POST com Body Fragmentado

```mermaid
sequenceDiagram
    participant Client
    participant Buffer
    participant Parser

    Note over Client: POST /files/test.txt<br/>Content-Length: 12<br/><br/>Hello World!

    Client->>Buffer: Chunk 1: "POST /files/test.txt HTTP/1.1\r\nContent-Length: 12\r\nHost: localhost\r\n\r\n"
    Note over Buffer: Headers completos (60 bytes)<br/>Body esperado: 12 bytes<br/>Total esperado: 72 bytes<br/>Atual: 60 bytes
    Buffer->>Parser: indexOf("\r\n\r\n") = 56 ✓
    Parser->>Parser: Parse: Content-Length = 12
    Parser->>Parser: Preciso de 72 bytes total
    Parser->>Parser: Tenho 60 bytes
    Parser-->>Buffer: ❌ 60 < 72, aguarda body

    Client->>Buffer: Chunk 2: "Hello W"
    Note over Buffer: Total: 67 bytes
    Parser->>Parser: Tenho 67 bytes
    Parser-->>Buffer: ❌ 67 < 72, aguarda mais

    Client->>Buffer: Chunk 3: "orld!"
    Note over Buffer: Total: 72 bytes ✓
    Parser->>Parser: Tenho 72 bytes
    Parser->>Parser: ✅ 72 >= 72, completo!
    Parser->>Parser: Extrai headers e body
    Parser->>Parser: Salva arquivo
    Parser-->>Client: HTTP/1.1 201 Created
    Parser->>Buffer: Remove 72 bytes
    Note over Buffer: buffer = [] (vazio)
```

## Cálculo de Bytes

```
┌────────────────────────────────────────────────────────────┐
│ Requisição POST Completa                                   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ POST /files/test.txt HTTP/1.1\r\n                         │
│ Content-Length: 12\r\n                                     │
│ Host: localhost\r\n                                        │
│ \r\n                               ← headerEnd = 56        │
│ Hello World!                       ← body (12 bytes)       │
│                                                            │
│ ┌──────────────┬────────────────┐                         │
│ │   Headers    │      Body      │                         │
│ │  60 bytes    │   12 bytes     │                         │
│ │ (56 + 4)     │                │                         │
│ └──────────────┴────────────────┘                         │
│                                                            │
│ totalLength = headerEnd + 4 + contentLength                │
│             = 56 + 4 + 12                                  │
│             = 72 bytes                                     │
│                                                            │
│ ✅ Só processa quando buffer.length >= 72                 │
└────────────────────────────────────────────────────────────┘
```

## Código de Exemplo

```typescript
// Processa requisições com Content-Length
while (buffer.indexOf("\r\n\r\n") !== -1) {
  const headerEnd = buffer.indexOf("\r\n\r\n");
  const headerString = buffer.subarray(0, headerEnd).toString();

  // Extrai Content-Length se existir
  const match = headerString.match(/Content-Length: (\d+)/i);

  let totalLength;
  if (match) {
    const contentLength = parseInt(match[1]);
    totalLength = headerEnd + 4 + contentLength;
  } else {
    totalLength = headerEnd + 4; // Sem body
  }

  // Verifica se tem todos os bytes
  if (buffer.length < totalLength) {
    break; // Aguarda mais dados
  }

  // Extrai requisição completa
  const request = buffer.subarray(0, totalLength);
  processRequest(request);

  // Remove do buffer
  buffer = buffer.subarray(totalLength);
}
```

## Por que isso é importante?

Sem verificar `Content-Length`, você pode:

1. ❌ Processar body incompleto
2. ❌ Cortar dados do arquivo
3. ❌ Misturar body de uma requisição com headers da próxima
4. ❌ Corromper dados binários (imagens, PDFs, etc)
