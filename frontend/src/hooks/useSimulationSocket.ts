import { useEffect, useState, useCallback } from "react";
import { getWebSocketUrl } from "../api/client";
import type { SimulationStreamMessage, Snapshot } from "../types";

interface UseSimulationSocketOptions {
  simulationId: string;
  onSnapshot?: (snapshot: Snapshot, timestep: number) => void;
  onCompleted?: () => void;
  onError?: (error: string) => void;
}

export function useSimulationSocket({
  simulationId,
  onSnapshot,
  onCompleted,
  onError,
}: UseSimulationSocketOptions) {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<SimulationStreamMessage | null>(null);

  const connect = useCallback(() => {
    try {
      const wsUrl = getWebSocketUrl(simulationId);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message: SimulationStreamMessage = JSON.parse(event.data);
          setLastMessage(message);

          if (message.status === "streaming" && message.snapshot) {
            onSnapshot?.(message.snapshot, message.timestep ?? 0);
          } else if (message.status === "completed") {
            onCompleted?.();
            ws.close();
          }
        } catch (err) {
          onError?.(`Failed to parse message: ${err}`);
        }
      };

      ws.onerror = () => {
        onError?.("WebSocket connection error");
        setConnected(false);
      };

      ws.onclose = () => {
        setConnected(false);
      };

      return ws;
    } catch (err) {
      onError?.(`Failed to connect: ${err}`);
      return null;
    }
  }, [simulationId, onSnapshot, onCompleted, onError]);

  useEffect(() => {
    // Only connect when we have a real simulation ID
    if (!simulationId) return;

    const ws = connect();
    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [connect, simulationId]);

  return { connected, lastMessage };
}
