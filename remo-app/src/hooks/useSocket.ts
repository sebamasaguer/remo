import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { WS_URL } from '../constants';

let globalSocket: Socket | null = null;
const listeners = new Set<(s: Socket) => void>();

function notifyListeners(s: Socket) {
  listeners.forEach((fn) => fn(s));
}

export function useSocket(): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(globalSocket?.connected ? globalSocket : null);

  useEffect(() => {
    if (globalSocket?.connected) {
      setSocket(globalSocket);
      return;
    }

    const handler = (s: Socket) => setSocket(s);
    listeners.add(handler);

    if (!globalSocket) {
      (async () => {
        const token = await SecureStore.getItemAsync('accessToken');
        if (!token) return;

        globalSocket = io(WS_URL, {
          auth: { token },
          transports: ['websocket'],
          reconnection: true,
        });

        globalSocket.on('connect', () => {
          notifyListeners(globalSocket!);
        });

        globalSocket.on('disconnect', () => {
          setSocket(null);
        });
      })();
    }

    return () => {
      listeners.delete(handler);
    };
  }, []);

  return socket;
}

export function disconnectSocket() {
  globalSocket?.disconnect();
  globalSocket = null;
}
