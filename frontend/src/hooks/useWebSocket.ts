import { useEffect, useRef, useCallback } from 'react'

export interface WSEvent {
  type:
    | 'lead:hot_alert'
    | 'campaign:sent'
    | 'lead:replied'
    | 'sync:complete'
    | 'connected'
    | 'cadence:paused'
    | 'opportunity:alert'
    | 'agent:handoff_needed'
  data: unknown
}

type WSHandler = (event: WSEvent) => void

let ws: WebSocket | null = null
let handlers: WSHandler[] = []
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let currentToken: string | null = null

function getWsUrl(token: string) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.hostname
  const port = '3000' // backend port
  return `${protocol}//${host}:${port}/ws?token=${token}`
}

function connect(token: string) {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return

  currentToken = token
  ws = new WebSocket(getWsUrl(token))

  ws.onopen = () => {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  }

  ws.onmessage = (e) => {
    try {
      const msg: WSEvent = JSON.parse(e.data)
      handlers.forEach((h) => h(msg))
    } catch { /* ignore parse errors */ }
  }

  ws.onclose = (e) => {
    // Reconnect after 5s unless intentionally closed (code 4001)
    if (e.code !== 4001 && currentToken) {
      reconnectTimer = setTimeout(() => connect(currentToken!), 5000)
    }
  }

  ws.onerror = () => {
    ws?.close()
  }
}

function disconnect() {
  currentToken = null
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  if (ws) { ws.close(); ws = null }
}

export function useWebSocket(token: string | null, onEvent: WSHandler) {
  const handlerRef = useRef<WSHandler>(onEvent)
  handlerRef.current = onEvent

  const stableHandler = useCallback((event: WSEvent) => {
    handlerRef.current(event)
  }, [])

  useEffect(() => {
    if (!token) {
      disconnect()
      return
    }

    handlers.push(stableHandler)
    connect(token)

    return () => {
      handlers = handlers.filter((h) => h !== stableHandler)
      if (handlers.length === 0) disconnect()
    }
  }, [token, stableHandler])
}
