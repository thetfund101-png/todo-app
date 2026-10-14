import compression from 'compression'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import hpp from 'hpp'
import { config } from './config.js'
import { HttpError } from './errors.js'
import { errorHandler } from './middleware/errors.js'
import { csrfProtection } from './middleware/csrf.js'
import { requestLogger } from './logger.js'
import authRoutes from './routes/auth.js'
import adminRoutes from './routes/admin.js'
import categoriesRoutes from './routes/categories.js'
import dashboardRoutes from './routes/dashboard.js'
import dataRoutes from './routes/data.js'
import settingsRoutes from './routes/settings.js'
import tasksRoutes from './routes/tasks.js'
import usersRoutes from './routes/users.js'
import weeklyPlansRoutes from './routes/weekly-plans.js'

export const app = express()

const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
})

app.disable('x-powered-by')
app.set('trust proxy', config.trustProxyHops)
app.use(requestLogger)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: ["'self'", config.clientOrigin],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        upgradeInsecureRequests: config.isProduction ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
)
app.use(
  cors({
    origin: config.clientOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-ID'],
    maxAge: 600,
  }),
)
app.use(compression())
app.use(express.json({ limit: '256kb', strict: true, type: 'application/json' }))
app.use(cookieParser())
app.use(hpp())
app.use(globalRateLimit)
app.use(csrfProtection)

app.get('/healthz', (_request, response) => {
  response.json({ status: 'ok' })
})

app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/tasks', tasksRoutes)
app.use('/api/v1/categories', categoriesRoutes)
app.use('/api/v1/settings', settingsRoutes)
app.use('/api/v1/users', usersRoutes)
app.use('/api/v1/weekly-plans', weeklyPlansRoutes)
app.use('/api/v1/dashboard', dashboardRoutes)
app.use('/api/v1/exports', dataRoutes)
app.use('/api/v1/admin', adminRoutes)

app.use((_request, _response, next) => next(new HttpError(404, 'NOT_FOUND', 'The requested resource was not found.')))
app.use(errorHandler)
