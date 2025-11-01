# Diagrama 2: Máquina de Estados do Parser HTTP

## Fluxo de processamento de requisições

```mermaid
stateDiagram-v2
    [*] --> Aguardando: Nova conexão

    Aguardando --> Acumular: socket.on("data") dispara

    Acumular --> VerificarCompleto: buffer += chunk

    VerificarCompleto --> Aguardando: indexOf("\r\n\r\n") == -1<br/>(requisição incompleta)
    VerificarCompleto --> ParseHeaders: indexOf("\r\n\r\n") >= 0<br/>(tem headers completos)

    ParseHeaders --> VerificarBody: Parseia headers HTTP

    VerificarBody --> Aguardando: Body incompleto<br/>(falta dados do POST)
    VerificarBody --> Processar: Body completo<br/>(ou GET sem body)

    Processar --> RemoverBuffer: requestCount++<br/>Envia resposta
    RemoverBuffer --> VerificarCompleto: buffer = buffer.subarray(...)<br/>Remove processado

    VerificarCompleto --> [*]: Buffer vazio<br/>Aguarda próximo evento

    note right of Acumular
        Buffer acumulativo
        persistente por conexão
    end note

    note right of Processar
        Gera resposta HTTP
        Incrementa contador
        Mantém keep-alive
    end note

    note left of VerificarBody
        Se tem Content-Length,
        verifica se body completo:
        buffer.length >= headerEnd + 4 + contentLength
    end note
```

## Estados Explicados

1. **Aguardando**: Conexão ociosa, esperando dados
2. **Acumular**: Adiciona chunk recebido ao buffer
3. **VerificarCompleto**: Checa se tem `\r\n\r\n` (fim de headers)
4. **ParseHeaders**: Extrai método, path, headers
5. **VerificarBody**: Se POST/PUT, verifica Content-Length
6. **Processar**: Executa lógica da requisição
7. **RemoverBuffer**: Remove dados processados do buffer

## Loop Contínuo

O estado `VerificarCompleto` volta para si mesmo enquanto houver requisições completas no buffer, permitindo processar múltiplas requisições em um único evento `data`.