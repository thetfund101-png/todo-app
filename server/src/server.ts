import { app } from './app.js'
import { config } from './config.js'
import { logger } from './logger.js'
import { pool } from './db/pool.js'

const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, 'Task tracker API listening')
})

server.requestTimeout = 30_000
server.headersTimeout = 35_000
server.keepAliveTimeout = 5_000

function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down API server')
  server.close((error) => {
    void pool.end().then(() => {
      if (error) {
        logger.error({ err: error }, 'API server shutdown failed')
        process.exitCode = 1
      }
    })
  })
  setTimeout(() => {
    logger.error('Graceful shutdown timed out')
    process.exit(1)
  }, 10_000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
