"use client";

import type { PropsWithChildren } from "react";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { WS_BASE } from "@/lib/api";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface UseWebSocketOptions {
  url?: string;
  onMessage?: (data: any) => void;
  reconnectInterval?: number;
}

type Listener = (data: any) => void;

type WebSocketContextValue = {
  status: ConnectionStatus;
  url: string;
  subscribe: (listener: Listener) => () => void;
  sendMessage: (message: any) => void;
};

const defaultWS = WS_BASE;
const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({
  children,
  url = defaultWS,
  reconnectInterval = 3000,
}: PropsWithChildren<{ url?: string; reconnectInterval?: number }>) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const socketRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Set<Listener>>(new Set());

  useEffect(() => {
    if (!url) {
      setStatus("disconnected");
      return;
    }

    let mounted = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (!mounted) return;
      if (
        socketRef.current?.readyState === WebSocket.OPEN ||
        socketRef.current?.readyState === WebSocket.CONNECTING
      ) {
        return;
      }

      setStatus("connecting");
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        if (!mounted || socketRef.current !== socket) return;
        setStatus("connected");
      };

      socket.onmessage = (event) => {
        if (socketRef.current !== socket) return;
        try {
          const data = JSON.parse(event.data);
          listenersRef.current.forEach((listener) => listener(data));
        } catch (err) {
          console.warn("Ignoring malformed websocket message", err);
        }
      };

      socket.onclose = () => {
        if (!mounted || socketRef.current !== socket) return;
        socketRef.current = null;
        setStatus("disconnected");
        reconnectTimer = setTimeout(connect, reconnectInterval);
      };

      socket.onerror = () => {
        if (socketRef.current === socket) {
          socket.close();
        }
      };
    };

    connect();

    return () => {
      mounted = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [url, reconnectInterval]);

  const subscribe = useCallback((listener: Listener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  }, []);

  const value = useMemo<WebSocketContextValue>(
    () => ({ status, url, subscribe, sendMessage }),
    [status, url, subscribe, sendMessage],
  );

  return createElement(WebSocketContext.Provider, { value }, children);
}

export function useWebSocket({
  url = defaultWS,
  onMessage,
  reconnectInterval = 3000,
}: UseWebSocketOptions = {}) {
  const sharedSocket = useContext(WebSocketContext);
  const onMessageRef = useRef(onMessage);
  const [localStatus, setLocalStatus] = useState<ConnectionStatus>("disconnected");
  const localSocketRef = useRef<WebSocket | null>(null);

  onMessageRef.current = onMessage;
  const usesSharedSocket = Boolean(sharedSocket && sharedSocket.url === url);

  useEffect(() => {
    if (!usesSharedSocket || !sharedSocket) return;
    return sharedSocket.subscribe((data) => {
      onMessageRef.current?.(data);
    });
  }, [sharedSocket, usesSharedSocket]);

  useEffect(() => {
    if (usesSharedSocket) return;
    if (!url) {
      setLocalStatus("disconnected");
      return;
    }

    let mounted = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (!mounted) return;
      if (
        localSocketRef.current?.readyState === WebSocket.OPEN ||
        localSocketRef.current?.readyState === WebSocket.CONNECTING
      ) {
        return;
      }

      setLocalStatus("connecting");
      const socket = new WebSocket(url);
      localSocketRef.current = socket;

      socket.onopen = () => {
        if (!mounted || localSocketRef.current !== socket) return;
        setLocalStatus("connected");
      };

      socket.onmessage = (event) => {
        if (localSocketRef.current !== socket) return;
        try {
          onMessageRef.current?.(JSON.parse(event.data));
        } catch (err) {
          console.warn("Ignoring malformed websocket message", err);
        }
      };

      socket.onclose = () => {
        if (!mounted || localSocketRef.current !== socket) return;
        localSocketRef.current = null;
        setLocalStatus("disconnected");
        reconnectTimer = setTimeout(connect, reconnectInterval);
      };

      socket.onerror = () => {
        if (localSocketRef.current === socket) {
          socket.close();
        }
      };
    };

    connect();

    return () => {
      mounted = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (localSocketRef.current) {
        localSocketRef.current.close();
        localSocketRef.current = null;
      }
    };
  }, [reconnectInterval, url, usesSharedSocket]);

  const sendMessage = useCallback((message: any) => {
    if (usesSharedSocket && sharedSocket) {
      sharedSocket.sendMessage(message);
      return;
    }

    if (localSocketRef.current?.readyState === WebSocket.OPEN) {
      localSocketRef.current.send(JSON.stringify(message));
    }
  }, [sharedSocket, usesSharedSocket]);

  return {
    status: usesSharedSocket && sharedSocket ? sharedSocket.status : localStatus,
    sendMessage,
  };
}
