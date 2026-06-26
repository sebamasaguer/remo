import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { WS_URL } from '../constants';

let globalSocket: Socket | null = null;

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (globalSocket?.connected) {
      socketRef.current = globalSocket;
      return;
    }

    (async () => {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;

      globalSocket = io(WS_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
      });

      socketRef.current = globalSocket;
    })();

    return () => {
      // no desconectamos al desmontar — la conexión persiste en la sesión
    };
  }, []);

  return socketRef.current;
}

export function disconnectSocket() {
  globalSocket?.disconnect();
  globalSocket = null;
}
