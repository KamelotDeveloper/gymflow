import express from 'express'
import cors from 'cors'
import cron from 'node-cron'
import membersRouter from './routes/members.js'
import { expireMemberships } from './jobs/expireMemberships.js'

const app = express()
const PORT = process.env.PORT || 3000
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

// ── Middleware ──
const allowedOrigins = FRONTEND_URL.split(',').map((s) => s.trim())
app.use(cors({ origin: allowedOrigins }))
app.use(express.json())

// ── Routes ──
app.use('/api/members', membersRouter)

// ── Health check ──
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── Cron: expire membresías todos los días a las 03:00 ──
cron.schedule('0 3 * * *', () => {
  expireMemberships()
})

// ── Start ──
app.listen(PORT, () => {
  console.log(`🏋️ GymFlow backend running on port ${PORT}`)
})
