import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import { Server } from 'http'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'

interface AuthenticatedWS extends WebSocket {
  userId?: string
  isAlive?: boolean
}

interface WSMessage {
  type: string
  data: unknown
}

let wss: WebSocketServer | null = null

export function initWebSocket(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (ws: AuthenticatedWS, req: IncomingMessage) => {
    // Autentica via query param token
    const url = new URL(req.url || '', `http://localhost`)
    const token = url.searchParams.get('token')

    if (!token) {
      ws.close(4001, 'Unauthorized')
      return
    }

    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string }
      ws.userId = payload.sub
      ws.isAlive = true
      logger.info({ userId: ws.userId }, 'WebSocket client conectado')
    } catch {
      ws.close(4001, 'Invalid token')
      return
    }

    ws.on('pong', () => {
      ws.isAlive = true
    })

    ws.on('close', () => {
      logger.info({ userId: ws.userId }, 'WebSocket client desconectado')
    })

    ws.on('error', (err) => {
      logger.error({ err }, 'WebSocket error')
    })

    // Mensagem de boas-vindas
    ws.send(JSON.stringify({ type: 'connected', data: { userId: ws.userId } }))
  })

  // Heartbeat: verifica clientes a cada 30s, encerra os mortos
  const interval = setInterval(() => {
    wss?.clients.forEach((client) => {
      const ws = client as AuthenticatedWS
      if (!ws.isAlive) {
        ws.terminate()
        return
      }
      ws.isAlive = false
      ws.ping()
    })
  }, 30_000)

  wss.on('close', () => clearInterval(interval))

  logger.info('WebSocket server inicializado no path /ws')
  return wss
}

export function broadcast(message: WSMessage): void {
  if (!wss) return
  const payload = JSON.stringify(message)
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload)
    }
  })
}

export function broadcastToUser(userId: string, message: WSMessage): void {
  if (!wss) return
  const payload = JSON.stringify(message)
  wss.clients.forEach((client) => {
    const ws = client as AuthenticatedWS
    if (ws.readyState === WebSocket.OPEN && ws.userId === userId) {
      ws.send(payload)
    }
  })
}

// Emissores de eventos convenientes para uso interno
export const wsEvents = {
  hotAlert: (
    lead: { id: string; name: string; businessName: string; score: number; classification: string },
    eventType: 'open' | 'click',
  ): void => {
    broadcast({
      type: 'lead:hot_alert',
      data: { lead, eventType, timestamp: new Date().toISOString() },
    })
  },

  campaignSent: (
    campaign: { id: string; name: string },
    stats: { sent: number; failed: number },
  ): void => {
    broadcast({
      type: 'campaign:sent',
      data: { campaign, stats, timestamp: new Date().toISOString() },
    })
  },

  leadReplied: (
    lead: { id: string; name: string; businessName: string },
    campaignId: string,
  ): void => {
    broadcast({
      type: 'lead:replied',
      data: { lead, campaignId, timestamp: new Date().toISOString() },
    })
  },

  syncComplete: (stats: { rowsImported: number; rowsUpdated: number; status: string }): void => {
    broadcast({
      type: 'sync:complete',
      data: { stats, timestamp: new Date().toISOString() },
    })
  },

  opportunityAlert: (alert: {
    id: string
    leadId: string
    type: string
    title: string
    urgency: number
  }): void => {
    broadcast({
      type: 'opportunity:alert',
      data: { alert, timestamp: new Date().toISOString() },
    })
  },
}
