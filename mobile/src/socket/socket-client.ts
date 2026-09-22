import { io, Socket } from 'socket.io-client';
import { Message, SocketEvents } from '../types';

/**
 * Socket.io client for real-time messaging and signaling
 * Handles:
 * - Presence (online/offline/typing)
 * - Message relay and acknowledgment
 * - WebRTC signaling (offer/answer/ICE)
 * - Group messaging
 */

export interface SocketClientConfig {
  serverUrl: string;
  accessToken: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onMessageReceive?: (message: Message) => void;
  onPresenceUpdate?: (phoneHash: string, status: 'online' | 'offline' | 'typing') => void;
  onWebRTCSignal?: (type: string, data: any) => void;
}

export class SocketClient {
  private socket: Socket | null = null;
  private config: SocketClientConfig;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(config: SocketClientConfig) {
    this.config = config;
  }

  /**
   * Connect to Socket.io server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.config.serverUrl, {
          auth: {
            token: this.config.accessToken,
          },
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: this.maxReconnectAttempts,
          transports: ['websocket', 'polling'],
        });

        // Connection events
        this.socket.on('connect', () => {
          console.log('Socket connected:', this.socket?.id);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.config.onConnect?.();
          resolve();
        });

        this.socket.on('disconnect', (reason) => {
          console.log('Socket disconnected:', reason);
          this.isConnected = false;
          this.config.onDisconnect?.();
        });

        this.socket.on('connect_error', (error) => {
          console.error('Socket connection error:', error);
          this.reconnectAttempts++;
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            reject(error);
          }
        });

        // Message events
        this.socket.on('message:receive', (message: Message) => {
          this.config.onMessageReceive?.(message);
        });

        // Presence events
        this.socket.on('presence:update', (data: { contactId: string; status: 'online' | 'offline' | 'typing' }) => {
          this.config.onPresenceUpdate?.(data.contactId, data.status);
        });

        // WebRTC signaling
        this.socket.on('signal:offer', (data) => {
          this.config.onWebRTCSignal?.('offer', data);
        });

        this.socket.on('signal:answer', (data) => {
          this.config.onWebRTCSignal?.('answer', data);
        });

        this.socket.on('signal:ice_candidate', (data) => {
          this.config.onWebRTCSignal?.('ice_candidate', data);
        });

        // Timeout for connection
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('Socket connection timeout'));
          }
        }, 10000);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Send message to recipient
   */
  sendMessage(toPhoneHash: string, encryptedBlob: string, nonce: string): void {
    if (!this.socket || !this.isConnected) {
      throw new Error('Socket not connected');
    }

    this.socket.emit('message:send', {
      toPhoneHash,
      encryptedBlob,
      nonce,
    });
  }

  /**
   * Acknowledge message received
   */
  acknowledgeMessage(messageId: string, delivered = true): void {
    if (!this.socket || !this.isConnected) {
      throw new Error('Socket not connected');
    }

    this.socket.emit('message:ack', {
      messageId,
      delivered,
    });
  }

  /**
   * Update presence status
   */
  updatePresence(status: 'online' | 'offline' | 'typing'): void {
    if (!this.socket || !this.isConnected) {
      console.warn('Socket not connected, presence update queued');
      return;
    }

    this.socket.emit('presence:update', { status });
  }

  /**
   * Send WebRTC offer (initiate call)
   */
  sendOffer(toPhoneHash: string, offer: RTCSessionDescription): void {
    if (!this.socket || !this.isConnected) {
      throw new Error('Socket not connected');
    }

    this.socket.emit('signal:offer', {
      toPhoneHash,
      offer: offer.toJSON(),
    });
  }

  /**
   * Send WebRTC answer (accept call)
   */
  sendAnswer(toPhoneHash: string, answer: RTCSessionDescription): void {
    if (!this.socket || !this.isConnected) {
      throw new Error('Socket not connected');
    }

    this.socket.emit('signal:answer', {
      toPhoneHash,
      answer: answer.toJSON(),
    });
  }

  /**
   * Send ICE candidate
   */
  sendICECandidate(toPhoneHash: string, candidate: RTCIceCandidate): void {
    if (!this.socket || !this.isConnected) {
      throw new Error('Socket not connected');
    }

    this.socket.emit('signal:ice_candidate', {
      toPhoneHash,
      candidate: {
        candidate: candidate.candidate,
        sdpMLineIndex: candidate.sdpMLineIndex,
        sdpMid: candidate.sdpMid,
      },
    });
  }

  /**
   * Send group message
   */
  sendGroupMessage(groupId: string, encryptedBlob: string, nonce: string): void {
    if (!this.socket || !this.isConnected) {
      throw new Error('Socket not connected');
    }

    this.socket.emit('group:message', {
      groupId,
      encryptedBlob,
      nonce,
    });
  }

  /**
   * Listen to group messages
   */
  onGroupMessage(callback: (message: any) => void): void {
    if (!this.socket) throw new Error('Socket not initialized');
    this.socket.on('group:message', callback);
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  /**
   * Check if connected
   */
  getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get socket ID
   */
  getSocketId(): string | undefined {
    return this.socket?.id;
  }

  /**
   * Emit raw event (for debugging)
   */
  emit(event: string, data?: any): void {
    if (!this.socket) throw new Error('Socket not initialized');
    this.socket.emit(event, data);
  }

  /**
   * Listen to raw event (for debugging)
   */
  on(event: string, callback: (data: any) => void): void {
    if (!this.socket) throw new Error('Socket not initialized');
    this.socket.on(event, callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback?: (data: any) => void): void {
    if (!this.socket) return;
    this.socket.off(event, callback);
  }
}

export default SocketClient;
