# HTTP Server from Scratch

An HTTP server built from scratch in TypeScript as part of the [CodeCrafters](https://codecrafters.io) challenge.

## About CodeCrafters

The idea is simple: **learn by doing**. Each challenge guides you through incremental stages, testing your code at each step, while you discover how these tools really work under the hood.

## About This Project

This project implements a **functional HTTP server** from scratch, without using frameworks like Express or Fastify. Using only Node.js's `net` module, the server is capable of:

- ✅ Accepting TCP connections
- ✅ Parsing HTTP requests (request line, headers, body)
- ✅ Routing different endpoints
- ✅ Serving static and dynamic content
- ✅ File manipulation (read and write)
- ✅ Supporting gzip compression

## Implemented Features

### Endpoints

| Method | Route               | Description                                     |
| ------ | ------------------- | ----------------------------------------------- |
| `GET`  | `/`                 | Returns 200 OK                                  |
| `GET`  | `/echo/{message}`   | Returns the sent message                        |
| `GET`  | `/user-agent`       | Returns the client's User-Agent                 |
| `GET`  | `/files/{filename}` | Serves files from the configured directory      |
| `POST` | `/files/{filename}` | Creates/saves files in the configured directory |

### Advanced Features

- **Gzip compression**: Supports `Accept-Encoding: gzip` to compress responses
- **Robust parsing**: Correctly separates headers and body, even with binary data
- **HTTP headers**: Implements `Content-Type`, `Content-Length`, `Content-Encoding`
- **Status codes**: 200 OK, 201 Created, 400 Bad Request, 404 Not Found, 500 Internal Server Error

## Technologies Used

- **TypeScript**: Main language
- **Node.js**: Runtime
- **Native modules**:
  - `net`: TCP server creation
  - `fs`: File manipulation
  - `path`: Path manipulation
  - `zlib`: Gzip compression

## How to Run

### Installation

```bash
bun install
```

### Run the server

```bash
bun run app/main.ts
```

### Run with custom directory

```bash
bun run app/main.ts --directory /path/to/files
```

The server will be available at `http://localhost:4221`

## Usage Examples

### Echo endpoint

```bash
curl http://localhost:4221/echo/hello
# Returns: hello
```

### Echo with gzip compression

```bash
curl http://localhost:4221/echo/banana -H "Accept-Encoding: gzip" --output - | gzip -d
# Returns: banana (decompressed)
```

### User-Agent

```bash
curl http://localhost:4221/user-agent
# Returns: curl/7.68.0
```

### Create file

```bash
curl -X POST http://localhost:4221/files/test.txt \
  --data "Hello, World!" \
  -H "Content-Type: application/octet-stream"
# Creates the file test.txt with the content "Hello, World!"
```

### Read file

```bash
curl http://localhost:4221/files/test.txt
# Returns the file content
```

## What I Learned

Building this HTTP server from scratch, I learned:

- How the HTTP protocol works (request/response cycle)
- Low-level HTTP request parsing
- Buffer and stream manipulation in Node.js
- How servers handle content compression
- Differences between textual and binary data
- TCP socket management
- Routing and middleware concepts

## Next Steps

Possible future improvements:

- [ ] Support for more compression algorithms (deflate, br)
- [ ] Implement HTTP/2
- [ ] Add middleware system
- [ ] Cookie and session support
- [ ] HTTPS/TLS
- [ ] Large file streaming
- [ ] Rate limiting
- [ ] CORS

## License

This project was created for educational purposes as part of the CodeCrafters challenge.
