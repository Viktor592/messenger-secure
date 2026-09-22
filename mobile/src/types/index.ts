// Authentication & User
export interface User {
  id: string;
  phoneHash: string;
  displayName: string;
  publicKey: string;
  identityKeyFingerprint: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface SmsVerification {
  sessionToken: string;
  phoneHash: string;
  codesSent: number;
  expiresAt: number;
}

// Contacts
export interface Contact {
  id: string;
  phoneHash: string;
  displayName: string;
  publicKey: string;
  identityKeyFingerprint: string;
  status: 'online' | 'offline' | 'typing';
  lastSeen?: Date;
  createdAt: Date;
}

export interface ContactVerification {
  contactId: string;
  fingerprint: string;
  verified: boolean;
  verifiedAt?: Date;
}

// Messages
export interface Message {
  id: string;
  fromPhoneHash: string;
  toPhoneHash: string;
  encryptedBlob: string;
  nonce: string;
  timestamp: Date;
  isRead: boolean;
  deletedAt?: Date;
}

export interface MessageInput {
  toPhoneHash: string;
  plaintext: string;
  type: 'text' | 'voice' | 'media';
}

export interface PendingMessage {
  id: string;
  toPhoneHash: string;
  encryptedBlob: string;
  nonce: string;
  timestamp: Date;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  retries: number;
}

// Groups
export interface Group {
  id: string;
  name: string;
  creatorPhoneHash: string;
  members: GroupMember[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupMember {
  id: string;
  groupId: string;
  phoneHash: string;
  role: 'admin' | 'member';
  joinedAt: Date;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  fromPhoneHash: string;
  encryptedBlob: string;
  nonce: string;
  timestamp: Date;
  isRead: boolean;
}

// Crypto - Local State
export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface NoiseState {
  symmetricKey: Uint8Array;
  nonce: Uint8Array;
}

export interface RatchetState {
  dh: KeyPair;
  pn: number; // Previous chain message number
  cn: number; // Chain message number
  ckSend: Uint8Array; // Chain key send
  ckRecv: Uint8Array; // Chain key recv
  mkSend: Uint8Array; // Message key send
  mkRecv: Uint8Array; // Message key recv
}

export interface ConversationState {
  conversationId: string;
  contactPhoneHash: string;
  ratchetState: RatchetState;
  lastMessageTimestamp: number;
  updatedAt: Date;
}

// WebRTC
export interface RTCSignal {
  type: 'offer' | 'answer' | 'ice_candidate';
  data: string | RTCIceCandidateInit;
}

export interface RTCOffer extends RTCSessionDescription {
  type: 'offer';
}

export interface RTCAnswer extends RTCSessionDescription {
  type: 'answer';
}

// Socket.io Events
export interface SocketEvents {
  // Presence
  'presence:update': (data: { status: 'online' | 'offline' | 'typing'; contactId: string }) => void;
  
  // Messaging
  'message:send': (data: { toPhoneHash: string; encryptedBlob: string; nonce: string }) => void;
  'message:receive': (data: Message) => void;
  'message:ack': (data: { messageId: string; delivered: boolean }) => void;
  
  // WebRTC Signaling
  'signal:offer': (data: { fromPhoneHash: string; offer: RTCOffer }) => void;
  'signal:answer': (data: { fromPhoneHash: string; answer: RTCAnswer }) => void;
  'signal:ice_candidate': (data: { fromPhoneHash: string; candidate: RTCIceCandidateInit }) => void;
  
  // Group Messaging
  'group:message': (data: GroupMessage) => void;
}

// Store State
export interface AuthStore {
  user: User | null;
  session: AuthSession | null;
  setUser: (user: User) => void;
  setSession: (session: AuthSession) => void;
  clearAuth: () => void;
}

export interface MessageStore {
  messages: Record<string, Message[]>;
  pendingMessages: PendingMessage[];
  addMessage: (message: Message) => void;
  addPendingMessage: (message: PendingMessage) => void;
  markAsRead: (messageId: string) => void;
  getConversation: (phoneHash: string) => Message[];
}

export interface ContactStore {
  contacts: Contact[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  addContact: (contact: Contact) => void;
  updateContactStatus: (phoneHash: string, status: Contact['status']) => void;
  getContact: (phoneHash: string) => Contact | undefined;
}

// API Responses
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface AuthResponse {
  sessionToken: string;
  expiresAt: number;
}

export interface VerifyResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface ContactSearchResponse {
  found: boolean;
  contact?: {
    phoneHash: string;
    displayName: string;
    publicKey: string;
    identityKeyFingerprint: string;
  };
}

// Navigation
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Chat: { contactPhoneHash: string; displayName: string };
  GroupChat: { groupId: string; groupName: string };
  Call: { contactPhoneHash: string; contactName: string };
};

export type AuthStackParamList = {
  PhoneInput: undefined;
  CodeVerification: { phoneHash: string; sessionToken: string };
  PinSetup: { phoneHash: string; sessionToken: string };
};

export type MainStackParamList = {
  Contacts: undefined;
  ContactDetails: { phoneHash: string };
  GroupList: undefined;
  GroupDetails: { groupId: string };
  Settings: undefined;
  Profile: undefined;
};
