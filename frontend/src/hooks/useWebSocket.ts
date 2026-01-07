import { useEffect, useRef, useState, useCallback } from 'react';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface UseWebSocketOptions {
  url?: string;
  onMessage?: (data: any) => void;
  reconnectInterval?: number;
}

const defaultWS = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws';

export function useWebSocket({ url = defaultWS, onMessage, reconnectInterval = 3000 }: UseWebSocketOptions = {}) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);

  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN || ws.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    setStatus('connecting');
    const socket = new WebSocket(url);
    ws.current = socket;

    socket.onopen = () => {
      if (isMounted.current) setStatus('connected');
    };

    socket.onmessage = (event) => {
      if (onMessageRef.current) {
        try {
          const data = JSON.parse(event.data);
          onMessageRef.current(data);
        } catch (err) {
          console.error("Failed to parse websocket message", err);
        }
      }
    };

    socket.onclose = () => {
      if (isMounted.current) {
        setStatus('disconnected');
        ws.current = null;
        reconnectTimer.current = setTimeout(() => {
          connect();
        }, reconnectInterval);
      }
    };

    socket.onerror = (err) => {
      console.error("WebSocket error:", err);
      // Let onclose handle the reconnect
      socket.close();
    };
  }, [url, reconnectInterval]);

  useEffect(() => {
    isMounted.current = true;
    connect();

    return () => {
      isMounted.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
    };
  }, [connect]);

  const sendMessage = useCallback((msg: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg));
    }
  }, []);

  return { status, sendMessage };
}
