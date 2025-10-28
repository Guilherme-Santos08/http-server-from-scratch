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
  socket.on("data", (data) => {
    const headerEndIndex = data.indexOf("\r\n\r\n");

    const headerString = data.subarray(0, headerEndIndex).toString();
    const bodyBuffer = data.subarray(headerEndIndex + 4);

    const lines = headerString.split("\r\n");
    const [httpMethod, requestPath] = lines[0].split(" ");

    if (requestPath === "/" && httpMethod === "GET") {
      socket.write(`HTTP/1.1 ${HTTP_STATUS_CODE.OK} OK\r\n`);
      socket.write("\r\n");
      return;
    }

    if (requestPath.startsWith("/echo/") && httpMethod === "GET") {
      const pathSegments = requestPath.split("/");
      if (pathSegments.length > 3) {
        return socket.write(
          `HTTP/1.1 ${HTTP_STATUS_CODE.NOT_FOUND} Not Found\r\n\r\n`
        );
      }
      const echoMessage = pathSegments[2];

      const acceptEncoding = getheaderValue(lines, "Accept-Encoding");
      const requestedEncodings = acceptEncoding.split(",").map((e) => e.trim());
      const supportedEncodings = requestedEncodings.filter((encoding) =>
        SUPPORTED_ENCODINGS.includes(encoding)
      );

      socket.write(`HTTP/1.1 ${HTTP_STATUS_CODE.OK} OK\r\n`);
      socket.write("Content-Type: text/plain\r\n");

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

      socket.end();
      return;
    }

    if (requestPath.startsWith("/user-agent") && httpMethod === "GET") {
      const userAgent = getheaderValue(lines, "User-Agent");

      socket.write(`HTTP/1.1 ${HTTP_STATUS_CODE.OK} OK\r\n`);
      socket.write("Content-Type: text/plain\r\n");
      socket.write(`Content-Length: ${userAgent.length.toString()}\r\n`);
      socket.write("\r\n");
      socket.write(userAgent);
      socket.end();
      return;
    }

    if (requestPath.startsWith("/files/") && httpMethod === "GET") {
      const fileName = requestPath.slice("/files/".length);
      const fullPath = path.join(baseDirectory, fileName);

      if (!fs.existsSync(fullPath)) {
        socket.write(`HTTP/1.1 ${HTTP_STATUS_CODE.NOT_FOUND} Not Found\r\n`);
        socket.write("\r\n");
        socket.end();
        return;
      }

      const file = fs.readFileSync(fullPath);
      socket.write(`HTTP/1.1 ${HTTP_STATUS_CODE.OK} OK\r\n`);
      socket.write("Content-Type: application/octet-stream\r\n");
      socket.write(`Content-Length: ${file.length}\r\n`);
      socket.write("\r\n");
      socket.write(new Uint8Array(file));
      socket.end();

      return;
    }

    if (requestPath.startsWith("/files/") && httpMethod === "POST") {
      const fileName = requestPath.slice("/files/".length);
      const fullPath = path.join(baseDirectory, fileName);

      const contentLength = parseInt(getheaderValue(lines, "Content-Length"));

      if (bodyBuffer.length < contentLength) {
        socket.write(
          `HTTP/1.1 ${HTTP_STATUS_CODE.BAD_REQUEST} Bad Request\r\n\r\n`
        );
        socket.end();
        return;
      }

      try {
        fs.writeFileSync(fullPath, bodyBuffer.toString());
        socket.write(`HTTP/1.1 ${HTTP_STATUS_CODE.CREATED} Created\r\n`);
        socket.write("\r\n");
        socket.end();
        return;
      } catch {
        socket.write(
          `HTTP/1.1 ${HTTP_STATUS_CODE.SERVER_ERROR} Internal Server Error\r\n`
        );
        socket.write("\r\n");
        socket.end();
        return;
      }
    }

    socket.write(`HTTP/1.1 ${HTTP_STATUS_CODE.NOT_FOUND} Not Found\r\n\r\n`);
    socket.write("\r\n");
  });

  socket.on("close", () => {
    socket.end();
  });
});

server.listen(4221, "localhost");
