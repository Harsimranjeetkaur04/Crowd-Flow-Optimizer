import { useEffect, useState, useRef } from "react";
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

  const onSnapshotRef = useRef(onSnapshot);
  const onCompletedRef = useRef(onCompleted);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onSnapshotRef.current = onSnapshot;
    onCompletedRef.current = onCompleted;
    onErrorRef.current = onError;
  }, [onSnapshot, onCompleted, onError]);

  useEffect(() => {
    if (!simulationId) return;

    let ws: WebSocket | null = null;

    try {
      const wsUrl = getWebSocketUrl(simulationId);
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message: SimulationStreamMessage = JSON.parse(event.data);
          setLastMessage(message);

          if (message.status === "streaming" && message.snapshot) {
            onSnapshotRef.current?.(message.snapshot, message.timestep ?? 0);
          } else if (message.status === "completed") {
            onCompletedRef.current?.();
            ws?.close();
          }
        } catch (err) {
          onErrorRef.current?.(`Failed to parse message: ${err}`);
        }
      };

      ws.onerror = () => {
        onErrorRef.current?.("WebSocket connection error");
        setConnected(false);
      };

      ws.onclose = () => {
        setConnected(false);
      };
    } catch (err) {
      onErrorRef.current?.(`Failed to connect: ${err}`);
    }

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [simulationId]);

  return { connected, lastMessage };
}
