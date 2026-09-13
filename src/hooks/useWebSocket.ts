import { useEffect, useRef, useCallback, useState } from 'react';
import { Client, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { WsMessage } from '@/types/warehouse';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://deliveryinventoryservice.onrender.com';

export type WsReadyState = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';

interface UseWebSocketOptions {
  topics: string[];
  onMessage: (msg: WsMessage) => void;
  enabled?: boolean;
}

/**
 * Manages a STOMP-over-SockJS connection to the backend /ws endpoint.
 * Reconnects automatically with exponential back-off (max 30 s).
 */
export function useWebSocket({ topics, onMessage, enabled = true }: UseWebSocketOptions) {
  const clientRef = useRef<Client | null>(null);
  const subsRef   = useRef<StompSubscription[]>([]);
  const retryMs   = useRef(1000);
  const [readyState, setReadyState] = useState<WsReadyState>('DISCONNECTED');

  const onMessageRef = useRef(onMessage);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);

  const connect = useCallback(() => {
    if (!enabled) return;
    setReadyState('CONNECTING');

    const client = new Client({
      webSocketFactory: () => new SockJS(`${BASE_URL}/ws`),
      reconnectDelay: 0, // we handle reconnect ourselves below

      onConnect: () => {
        retryMs.current = 1000;
        setReadyState('CONNECTED');

        subsRef.current = topics.map(topic =>
          client.subscribe(topic, frame => {
            try {
              const msg: WsMessage = JSON.parse(frame.body);
              onMessageRef.current(msg);
            } catch {
              // silently ignore malformed frames
            }
          })
        );
      },

      onDisconnect: () => {
        setReadyState('DISCONNECTED');
        scheduleReconnect();
      },

      onStompError: () => {
        setReadyState('DISCONNECTED');
        scheduleReconnect();
      },
    });

    clientRef.current = client;
    client.activate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, topics.join(',')]);

  const scheduleReconnect = useCallback(() => {
    const delay = retryMs.current;
    retryMs.current = Math.min(retryMs.current * 2, 30_000);
    setTimeout(connect, delay);
  }, [connect]);

  useEffect(() => {
    if (enabled) connect();
    return () => {
      subsRef.current.forEach(s => s.unsubscribe());
      subsRef.current = [];
      clientRef.current?.deactivate();
    };
  }, [enabled, connect]);

  return { readyState };
}
