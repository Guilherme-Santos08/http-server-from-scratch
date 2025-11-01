# Diagrama 8: Resumo da Implementação

## Antes vs Depois - Comparação Visual

```mermaid
graph LR
    subgraph Antes["❌ CÓDIGO ATUAL (PROBLEMÁTICO)"]
        A1[socket.on data] --> A2{indexOf \\r\\n\\r\\n?}
        A2 -->|SIM| A3[Processa 1x]
        A2 -->|NÃO| A4[QUEBRA!]
        A3 --> A5[return]
    end

    subgraph Depois["✅ CÓDIGO NOVO (ROBUSTO)"]
        B1[socket.on data] --> B2[buffer += chunk]
        B2 --> B3[while loop]
        B3 --> B4{Req completa?}
        B4 -->|NÃO| B5[Aguarda no buffer]
        B4 -->|SIM| B6[Processa]
        B6 --> B7[requestCount++]
        B7 --> B8[Remove do buffer]
        B8 --> B3
        B5 --> B9[Mantém estado]

    end
```

## Checklist de Implementação

```mermaid
flowchart TD
    Start([Início]) --> Step1{1. Adicionar variáveis<br/>de estado por conexão?}

    Step1 -->|✅ FEITO| Step2{2. Substituir processamento<br/>direto por acumulação?}
    Step1 -->|❌ FALTA| AddVars[let buffer = Buffer.alloc 0<br/>let requestCount = 0]
    AddVars --> Step2

    Step2 -->|✅ FEITO| Step3{3. Adicionar while loop<br/>para múltiplas requisições?}
    Step2 -->|❌ FALTA| AddConcat[buffer = Buffer.concat buffer, chunk]
    AddConcat --> Step3

    Step3 -->|✅ FEITO| Step4{4. Verificar Content-Length<br/>para POST?}
    Step3 -->|❌ FALTA| AddLoop[while buffer.indexOf \\r\\n\\r\\n != -1]
    AddLoop --> Step4

    Step4 -->|✅ FEITO| Step5{5. Remover requisição<br/>processada do buffer?}
    Step4 -->|❌ FALTA| AddCL[Calcular totalLength com body]
    AddCL --> Step5

    Step5 -->|✅ FEITO| Step6{6. Incrementar contador<br/>por requisição?}
    Step5 -->|❌ FALTA| AddRemove[buffer = buffer.subarray totalLength]
    AddRemove --> Step6

    Step6 -->|✅ FEITO| Done([✅ Implementação Completa!])
    Step6 -->|❌ FALTA| AddCounter[requestCount++<br/>Log contador]
    AddCounter --> Done
```

## Estrutura Final do Código

```mermaid
classDiagram
    class Server {
        +net.Server server
        +listen(port, host)
    }

    class SocketConnection {
        -Buffer buffer
        -number requestCount
        -string clientId
        -number timeout
        +onData(chunk)
        +onTimeout()
        +onClose()
    }

    class RequestProcessor {
        +parseHeaders(buffer)
        +extractContentLength(headers)
        +calculateTotalLength(headerEnd, contentLength)
        +extractRequest(buffer, totalLength)
        +processRequest(request)
    }

    class ResponseBuilder {
        +buildStatusLine(code)
        +buildHeaders(contentType, contentLength, keepAlive)
        +buildBody(content)
        +send(socket)
    }

    Server --> SocketConnection : creates multiple
    SocketConnection --> RequestProcessor : uses
    RequestProcessor --> ResponseBuilder : uses
    ResponseBuilder --> SocketConnection : sends via socket

    note for SocketConnection "Cada conexão tem seu<br/>próprio buffer e contador"
    note for RequestProcessor "Loop processa todas<br/>requisições completas"
```

## Alterações Necessárias no main.ts

### Localização das Mudanças

```
app/main.ts
│
├─ Linha 26: net.createServer((socket) => {
│  │
│  ├─ [ADICIONAR] Linha 27: let buffer = Buffer.alloc(0);
│  ├─ [ADICIONAR] Linha 28: let requestCount = 0;
│  │
│  ├─ Linha 38: socket.on("data", (data) => {
│  │  │
│  │  ├─ [MUDAR] data → chunk
│  │  ├─ [ADICIONAR] buffer = Buffer.concat([buffer, chunk]);
│  │  ├─ [ADICIONAR] while (buffer.indexOf("\r\n\r\n") !== -1) {
│  │  │
│  │  ├─ Linha 39-45: [MOVER PARA DENTRO DO WHILE]
│  │  │  └─ Parse headers, method, path
│  │  │
│  │  ├─ [ADICIONAR] Verificação Content-Length
│  │  ├─ [ADICIONAR] Cálculo totalLength
│  │  ├─ [ADICIONAR] Check buffer.length >= totalLength
│  │  │
│  │  ├─ Linha 53-189: [MANTER] Lógica de rotas
│  │  │  └─ Mas processar do buffer, não do data
│  │  │
│  │  ├─ [ADICIONAR] requestCount++
│  │  ├─ [ADICIONAR] buffer = buffer.subarray(totalLength)
│  │  │
│  │  └─ [ADICIONAR] } // fim do while
│  │
│  └─ Linha 192: socket.on("close", ...
│
└─ Linha 198: server.listen(4221, "localhost");
```

## Resumo dos Benefícios

| Problema                     | Solução               | Benefício                |
| ---------------------------- | --------------------- | ------------------------ |
| Requisição fragmentada       | Buffer acumulativo    | ✅ Nunca perde dados     |
| Múltiplas req no mesmo chunk | While loop            | ✅ Processa todas        |
| POST com body incompleto     | Content-Length check  | ✅ Aguarda body completo |
| Estado compartilhado         | Variáveis por closure | ✅ Conexões isoladas     |
| Não rastreia requisições     | requestCount++        | ✅ Métricas e limites    |

## Próximos Passos

1. ✅ Estudar diagramas (CONCLUÍDO!)
2. 🔄 Implementar buffer e loop (PRÓXIMO)
3. ⏳ Testar com curl --next
4. ⏳ Verificar logs e contadores
5. ⏳ Testar fragmentação manualmente

Pronto para começar a implementação? 🚀
