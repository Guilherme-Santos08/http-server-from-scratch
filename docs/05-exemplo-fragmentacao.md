# Diagrama 5: Exemplo Concreto - Fragmentação TCP

## Sequência de eventos com requisições fragmentadas

```mermaid
sequenceDiagram
    participant Buffer
    participant EventData as socket.on("data")
    participant Parser
    participant Response

    Note over Buffer: Estado inicial: buffer = []

    EventData->>Buffer: Evento 1: "GET /user"
    Note over Buffer: buffer = "GET /user"
    Buffer->>Parser: indexOf("\r\n\r\n") = -1
    Parser-->>Buffer: ❌ Incompleto, aguarda mais dados

    EventData->>Buffer: Evento 2: "-agent HTTP/1.1\r\nHost: localhost\r\n\r\n"
    Note over Buffer: buffer = "GET /user-agent HTTP/1.1\r\nHost: localhost\r\n\r\n"
    Buffer->>Parser: indexOf("\r\n\r\n") = 42 ✓
    Parser->>Parser: Extrai requisição completa
    Parser->>Response: HTTP/1.1 200 OK\r\n...\r\n{User-Agent}
    Parser->>Buffer: Remove dados processados
    Note over Buffer: buffer = [] (vazio)

    EventData->>Buffer: Evento 3: "GET /echo/abc...\r\n\r\nGET /echo/xyz..."
    Note over Buffer: buffer = "GET /echo/abc...\r\n\r\nGET /echo/xyz..."

    Note over Parser: Loop 1 - Primeira requisição
    Buffer->>Parser: indexOf("\r\n\r\n") = 42 ✓
    Parser->>Response: HTTP/1.1 200 OK\r\n...\r\nabc
    Parser->>Buffer: Remove primeira requisição
    Note over Buffer: buffer = "GET /echo/xyz..."

    Note over Parser: Loop 2 - Segunda (incompleta)
    Buffer->>Parser: indexOf("\r\n\r\n") = -1
    Parser-->>Buffer: ❌ Incompleta, aguarda resto

    EventData->>Buffer: Evento 4: "HTTP/1.1\r\nHost: localhost\r\n\r\n"
    Note over Buffer: buffer = "GET /echo/xyz HTTP/1.1\r\nHost: localhost\r\n\r\n"
    Buffer->>Parser: indexOf("\r\n\r\n") = 42 ✓
    Parser->>Response: HTTP/1.1 200 OK\r\n...\r\nxyz
    Parser->>Buffer: Remove dados processados
    Note over Buffer: buffer = [] (vazio)

    Note over Buffer,Response: ✅ Todas requisições processadas com sucesso!
```

## Linha do Tempo

| Tempo | Evento | Buffer State | Ação |
|-------|--------|--------------|------|
| t0 | Conexão aberta | `[]` | Aguarda |
| t1 | Chunk 1 | `"GET /user"` | Acumula, aguarda |
| t2 | Chunk 2 | `"GET /user-agent...\r\n\r\n"` | Processa req 1 |
| t3 | Após processar | `[]` | Buffer limpo |
| t4 | Chunk 3 | `"GET /echo/abc...\r\n\r\nGET /echo/xyz..."` | Processa req 2 |
| t5 | Após loop | `"GET /echo/xyz..."` | Aguarda resto |
| t6 | Chunk 4 | `"GET /echo/xyz...\r\n\r\n"` | Processa req 3 |
| t7 | Após processar | `[]` | Buffer limpo |

## Conclusão

O buffer age como um **acumulador resiliente** que:
1. ✅ Acumula fragmentos até ter requisição completa
2. ✅ Processa múltiplas requisições em loop
3. ✅ Mantém dados parciais para próximo evento
4. ✅ Nunca perde dados