import * as net from "net";
import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";

const dirIndex = process.argv.indexOf("--directory");
const baseDirectory = dirIndex !== -1 ? process.argv[dirIndex + 1] : ".";

const SUPPORTED_ENCODINGS = ["gzip"];

const HTTP_STATUS_CODE = {
  OK: 200,
  CREATED: 201,
  NOT_FOUND: 404,
  BAD_REQUEST: 400,
  SERVER_ERROR: 500,
};

const getheaderValue = (lines: string[], header: string) => {
  const target = lines.find((line) =>
    line.toLowerCase().startsWith(`${header.toLowerCase()}:`)
  );
  return target ? target.slice(header.length + 2) : "";
};

const server = net.createServer((socket) => {
  let buffer = Buffer.alloc(0);
  let requestCount = 0;

  const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[${new Date().toISOString()}] ✅ Nova conexão: ${clientId}`);

  // Timeout de 5 segundos para conexões inativas
  socket.setTimeout(5000);

  socket.on("timeout", () => {
    console.log(
      `[${new Date().toISOString()}] ⏱️  Timeout em ${clientId} - Fechando conexão`
    );
    socket.end();
  });

  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (buffer.indexOf("\r\n\r\n") !== -1) {
      const headerEndIndex = buffer.indexOf("\r\n\r\n");

      const headerString = buffer.subarray(0, headerEndIndex).toString();

      const lines = headerString.split("\r\n");
      const [httpMethod, requestPath] = lines[0].split(" ");

      console.log(
        `[${new Date().toISOString()}] 📥 ${clientId}: ${httpMethod} ${requestPath}`
      );

      // Verificar se o cliente quer manter a conexão aberta
      const connectionHeader = getheaderValue(lines, "Connection");
      const shouldKeepAlive = connectionHeader.toLowerCase() !== "close";

      if (requestPath === "/" && httpMethod === "GET") {
        socket.write(`HTTP/1.1 ${HTTP_STATUS_CODE.OK} OK\r\n`);
        socket.write(
          `Connection: ${shouldKeepAlive ? "keep-alive" : "close"}\r\n`
        );
        socket.write("\r\n");
        if (!shouldKeepAlive) socket.end();

        buffer = buffer.subarray(headerEndIndex + 4);
        requestCount++;
        console.log(
          `[${new Date().toISOString()}] ✅ ${clientId}: Requisição ${requestCount} processada`
        );

        continue;
      }

      if (requestPath.startsWith("/echo/") && httpMethod === "GET") {
        const pathSegments = requestPath.split("/");
        if (pathSegments.length > 3) {
          socket.write(
            `HTTP/1.1 ${HTTP_STATUS_CODE.NOT_FOUND} Not Found\r\n\r\n`
          );
          buffer = buffer.subarray(headerEndIndex + 4);
          requestCount++;
          console.log(
            `[${new Date().toISOString()}] ✅ ${clientId}: Requisição ${requestCount} processada`
          );
          continue;
        }
        const echoMessage = pathSegments[2];

        const acceptEncoding = getheaderValue(lines, "Accept-Encoding");

        const requestedEncodings = acceptEncoding
          .split(",")
          .map((e) => e.trim());
        const supportedEncodings = requestedEncodings.filter((encoding) =>
          SUPPORTED_ENCODINGS.includes(encoding)
        );

        socket.write(`HTTP/1.1 ${HTTP_STATUS_CODE.OK} OK\r\n`);
        socket.write("Content-Type: text/plain\r\n");
        socket.write(
          `Connection: ${shouldKeepAlive ? "keep-alive" : "close"}\r\n`
        );

        if (supportedEncodings.length > 0 && supportedEncodings[0] === "gzip") {
          const compressedContent = zlib.gzipSync(echoMessage);

          socket.write("Content-Encoding: gzip\r\n");
          socket.write(`Content-Length: ${compressedContent.length}\r\n`);
          socket.write("\r\n");
          socket.write(Uint8Array.from(compressedContent));
        } else {
          socket.write(`Content-Length: ${echoMessage.length}\r\n`);
          socket.write("\r\n");
          socket.write(echoMessage);
        }

        if (!shouldKeepAlive) socket.end();
        buffer = buffer.subarray(headerEndIndex + 4);
        requestCount++;
        console.log(
          `[${new Date().toISOString()}] ✅ ${clientId}: Requisição ${requestCount} processada`
        );
        continue;
      }

      if (requestPath.startsWith("/user-agent") && httpMethod === "GET") {
        const userAgent = getheaderValue(lines, "User-Agent");

        socket.write(`HTTP/1.1 ${HTTP_STATUS_CODE.OK} OK\r\n`);
        socket.write("Content-Type: text/plain\r\n");
        socket.write(
          `Connection: ${shouldKeepAlive ? "keep-alive" : "close"}\r\n`
        );
        socket.write(`Content-Length: ${userAgent.length.toString()}\r\n`);
        socket.write("\r\n");
        socket.write(userAgent);

        if (!shouldKeepAlive) socket.end();

        buffer = buffer.subarray(headerEndIndex + 4);
        requestCount++;
        console.log(
          `[${new Date().toISOString()}] ✅ ${clientId}: Requisição ${requestCount} processada`
        );
        continue;
      }

      if (requestPath.startsWith("/files/") && httpMethod === "GET") {
        const fileName = requestPath.slice("/files/".length);
        const fullPath = path.join(baseDirectory, fileName);

        if (!fs.existsSync(fullPath)) {
          socket.write(`HTTP/1.1 ${HTTP_STATUS_CODE.NOT_FOUND} Not Found\r\n`);
          socket.write(
            `Connection: ${shouldKeepAlive ? "keep-alive" : "close"}\r\n`
          );
          socket.write("\r\n");
          if (!shouldKeepAlive) socket.end();

          buffer = buffer.subarray(headerEndIndex + 4);
          requestCount++;
          console.log(
            `[${new Date().toISOString()}] ✅ ${clientId}: Requisição ${requestCount} processada`
          );
          continue;
        }

        const file = fs.readFileSync(fullPath);
        socket.write(`HTTP/1.1 ${HTTP_STATUS_CODE.OK} OK\r\n`);
        socket.write("Content-Type: application/octet-stream\r\n");
        socket.write(
          `Connection: ${shouldKeepAlive ? "keep-alive" : "close"}\r\n`
        );
        socket.write(`Content-Length: ${file.length}\r\n`);
        socket.write("\r\n");
        socket.write(new Uint8Array(file));

        if (!shouldKeepAlive) socket.end();

        buffer = buffer.subarray(headerEndIndex + 4);
        requestCount++;
        console.log(
          `[${new Date().toISOString()}] ✅ ${clientId}: Requisição ${requestCount} processada`
        );
        continue;
      }

      if (requestPath.startsWith("/files/") && httpMethod === "POST") {
        const fileName = requestPath.slice("/files/".length);
        const fullPath = path.join(baseDirectory, fileName);

        const contentLength = parseInt(getheaderValue(lines, "Content-Length"));
        const totalLength = headerEndIndex + 4 + contentLength;

        // Verifica se o body está completo (ver docs/06-post-content-length.md)
        if (buffer.length < totalLength) {
          break;  // Sai do while, aguarda mais dados do body
        }

        // Extrai body completo
        const bodyData = buffer.subarray(headerEndIndex + 4, totalLength);

        try {
          fs.writeFileSync(fullPath, bodyData.toString());
          socket.write(`HTTP/1.1 ${HTTP_STATUS_CODE.CREATED} Created\r\n`);
          socket.write(
            `Connection: ${shouldKeepAlive ? "keep-alive" : "close"}\r\n`
          );
          socket.write("\r\n");
          if (!shouldKeepAlive) socket.end();

          buffer = buffer.subarray(totalLength);
          requestCount++;
          console.log(
            `[${new Date().toISOString()}] ✅ ${clientId}: Requisição ${requestCount} processada`
          );
          continue;
        } catch {
          socket.write(
            `HTTP/1.1 ${HTTP_STATUS_CODE.SERVER_ERROR} Internal Server Error\r\n`
          );
          socket.write(
            `Connection: ${shouldKeepAlive ? "keep-alive" : "close"}\r\n`
          );
          socket.write("\r\n");
          if (!shouldKeepAlive) socket.end();

          buffer = buffer.subarray(totalLength);
          requestCount++;
          console.log(
            `[${new Date().toISOString()}] ✅ ${clientId}: Requisição ${requestCount} processada`
          );
          continue;
        }
      }

      socket.write(`HTTP/1.1 ${HTTP_STATUS_CODE.NOT_FOUND} Not Found\r\n`);
      socket.write(
        `Connection: ${shouldKeepAlive ? "keep-alive" : "close"}\r\n`
      );
      socket.write("\r\n");
      if (!shouldKeepAlive) socket.end();

      buffer = buffer.subarray(headerEndIndex + 4);
      requestCount++;
      console.log(
        `[${new Date().toISOString()}] ✅ ${clientId}: Requisição ${requestCount} processada`
      );
      continue;
    }
  });

  socket.on("close", () => {
    console.log(
      `[${new Date().toISOString()}] 🔴 Conexão fechada: ${clientId}`
    );
    socket.end();
  });
});

server.listen(4221, "localhost");
