// WebSocket service — ws://localhost:3000/ws
// Handshake: send { token } on connect
// Server confirms: { ok: true, event: "connected", userId: "..." }
//
// Usage:
//   import { wsService } from '../lib/websocket';
//   wsService.on('provision.bulk.complete', (payload) => { ... });
//   wsService.connect(token);
//   wsService.disconnect();

type WsEventName =
  | 'connected'
  | 'provision.bulk.complete'
  | 'deprovision.complete'
  | 'access.request.updated'
  | 'access.time.revoked'
  | 'recommendation.ready'
  | 'audit.report.ready';

type WsPayloadMap = {
  'connected':                 { ok: boolean; userId: string };
  'provision.bulk.complete':   { totalCreated: number; skipped?: number };
  'deprovision.complete':      { userId: string };
  'access.request.updated':    { requestId: string; status: string };
  'access.time.revoked':       { id: string };
  'recommendation.ready':      { userId: string };
  'audit.report.ready':        { reportId: string; downloadUrl: string; summary: string };
};

type WsListener<E extends WsEventName> = (payload: WsPayloadMap[E]) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyListener = (payload: any) => void;

// Use Vite proxy /ws → ws://localhost:3000 (avoids CORS on direct WS connection)
const WS_URL = (import.meta.env.VITE_WS_URL as string) || `ws://${window.location.host}/ws`;

class WebSocketService {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private listeners = new Map<string, Set<AnyListener>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manualClose = false;
  private reconnectDelay = 3000;

  connect(token: string) {
    this.token = token;
    this.manualClose = false;
    this._open();
  }

  disconnect() {
    this.manualClose = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  on<E extends WsEventName>(event: E, listener: WsListener<E>) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener as AnyListener);
  }

  off<E extends WsEventName>(event: E, listener: WsListener<E>) {
    this.listeners.get(event)?.delete(listener as AnyListener);
  }

  private _open() {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) return;

    const ws = new WebSocket(WS_URL);  // local ref — avoids stale this.ws in closures
    this.ws = ws;

    ws.onopen = () => {
      // readyState guaranteed OPEN here; use local ref not this.ws (may be reassigned)
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ token: this.token }));
      }
      this.reconnectDelay = 3000;
    };

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data as string) as { event: WsEventName; [k: string]: unknown };
        const set = this.listeners.get(data.event);
        if (set) set.forEach((fn) => fn(data));
      } catch { /* ignore malformed messages */ }
    };

    ws.onclose = () => {
      if (this.manualClose) return;
      // Exponential backoff reconnect (max 30s)
      this.reconnectTimer = setTimeout(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000);
        this._open();
      }, this.reconnectDelay);
    };

    ws.onerror = () => {
      ws.close(); // triggers onclose → reconnect
    };
  }
}

export const wsService = new WebSocketService();

// Helper hook — auto-connect/disconnect with token lifecycle
// Usage in component:
//   useWsEvent('provision.bulk.complete', (p) => console.log(p.totalCreated));
import { useEffect } from 'react';
import { useAuthStore } from '../stores/auth.store';

export function useWsConnect() {
  const token = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (token) {
      wsService.connect(token);
    } else {
      wsService.disconnect();
    }
    return () => {
      // Don't disconnect on unmount — connection is global
    };
  }, [token]);
}

export function useWsEvent<E extends WsEventName>(
  event: E,
  listener: WsListener<E>,
) {
  useEffect(() => {
    wsService.on(event, listener);
    return () => wsService.off(event, listener);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);
}
