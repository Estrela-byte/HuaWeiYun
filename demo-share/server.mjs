import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), 'dist')
const host = '127.0.0.1'
const port = Number(process.env.PORT || 4173)
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
}

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end()
    return
  }

  let pathname
  try {
    pathname = decodeURIComponent(new URL(request.url || '/', `http://${host}`).pathname)
  } catch {
    response.writeHead(400).end()
    return
  }

  const requestedFile = resolve(root, `.${pathname}`)
  if (requestedFile !== root && !requestedFile.startsWith(root + sep)) {
    response.writeHead(403).end()
    return
  }

  let file = requestedFile
  const details = await stat(file).catch(() => null)
  if (!details?.isFile()) {
    if (extname(pathname)) {
      response.writeHead(404).end()
      return
    }
    // Vue's browser-history routes all load the same HTML entry point.
    file = join(root, 'index.html')
  }

  try {
    const body = await readFile(file)
    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    })
    response.end(request.method === 'HEAD' ? undefined : body)
  } catch {
    response.writeHead(404).end()
  }
})

server.on('error', (error) => {
  console.error(`启动失败：${error.message}`)
  process.exitCode = 1
})

server.listen(port, host, () => {
  console.log(`SME-I 演示地址：http://${host}:${port}/`)
  console.log('按 Ctrl+C 结束演示服务。')
})
