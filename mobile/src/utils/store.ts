import { create } from 'zustand';
import { User, AuthSession, Contact, Message, Group } from '../types';

/**
 * Global state management using Zustand
 */

// ========== AUTH STORE ==========

interface AuthState {
  user: User | null;
  session: AuthSession | null;
  isLoading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  setSession: (session: AuthSession | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: false,
  error: null,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  clearAuth: () => set({ user: null, session: null, error: null }),
}));

// ========== CONTACT STORE ==========

interface ContactState {
  contacts: Contact[];
  selectedContact: Contact | null;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  addContact: (contact: Contact) => void;
  removeContact: (phoneHash: string) => void;
  updateContact: (contact: Contact) => void;
  updateContactStatus: (phoneHash: string, status: 'online' | 'offline' | 'typing') => void;
  setContacts: (contacts: Contact[]) => void;
  setSelectedContact: (contact: Contact | null) => void;
  setSearchQuery: (query: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  getContact: (phoneHash: string) => Contact | undefined;
  searchContacts: (query: string) => Contact[];
}

export const useContactStore = create<ContactState>((set, get) => ({
  contacts: [],
  selectedContact: null,
  searchQuery: '',
  isLoading: false,
  error: null,
  addContact: (contact) =>
    set((state) => ({
      contacts: [contact, ...state.contacts.filter((c) => c.phoneHash !== contact.phoneHash)],
    })),
  removeContact: (phoneHash) =>
    set((state) => ({
      contacts: state.contacts.filter((c) => c.phoneHash !== phoneHash),
    })),
  updateContact: (contact) =>
    set((state) => ({
      contacts: state.contacts.map((c) => (c.phoneHash === contact.phoneHash ? contact : c)),
    })),
  updateContactStatus: (phoneHash, status) =>
    set((state) => ({
      contacts: state.contacts.map((c) =>
        c.phoneHash === phoneHash ? { ...c, status } : c
      ),
    })),
  setContacts: (contacts) => set({ contacts }),
  setSelectedContact: (contact) => set({ selectedContact: contact }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  getContact: (phoneHash) => get().contacts.find((c) => c.phoneHash === phoneHash),
  searchContacts: (query) => {
    if (!query) return get().contacts;
    const lowerQuery = query.toLowerCase();
    return get().contacts.filter(
      (c) =>
        c.displayName.toLowerCase().includes(lowerQuery) ||
        c.phoneHash.includes(query)
    );
  },
}));

// ========== MESSAGE STORE ==========

interface MessageState {
  messages: Record<string, Message[]>; // Key: phoneHash, Value: messages with that contact
  pendingMessages: Message[];
  selectedConversation: string | null;
  isLoading: boolean;
  error: string | null;
  addMessage: (message: Message) => void;
  addPendingMessage: (message: Message) => void;
  removePendingMessage: (messageId: string) => void;
  setMessages: (phoneHash: string, messages: Message[]) => void;
  getConversation: (phoneHash: string) => Message[];
  markAsRead: (phoneHash: string, messageId: string) => void;
  setSelectedConversation: (phoneHash: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: {},
  pendingMessages: [],
  selectedConversation: null,
  isLoading: false,
  error: null,
  addMessage: (message) =>
    set((state) => {
      const key = message.fromPhoneHash === 'self' ? message.toPhoneHash : message.fromPhoneHash;
      return {
        messages: {
          ...state.messages,
          [key]: [...(state.messages[key] || []), message],
        },
      };
    }),
  addPendingMessage: (message) =>
    set((state) => ({
      pendingMessages: [...state.pendingMessages, message],
    })),
  removePendingMessage: (messageId) =>
    set((state) => ({
      pendingMessages: state.pendingMessages.filter((m) => m.id !== messageId),
    })),
  setMessages: (phoneHash, messages) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [phoneHash]: messages,
      },
    })),
  getConversation: (phoneHash) => get().messages[phoneHash] || [],
  markAsRead: (phoneHash, messageId) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [phoneHash]: state.messages[phoneHash].map((m) =>
          m.id === messageId ? { ...m, isRead: true } : m
        ),
      },
    })),
  setSelectedConversation: (phoneHash) => set({ selectedConversation: phoneHash }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));

// ========== GROUP STORE ==========

interface GroupState {
  groups: Group[];
  selectedGroup: Group | null;
  isLoading: boolean;
  error: string | null;
  addGroup: (group: Group) => void;
  removeGroup: (groupId: string) => void;
  updateGroup: (group: Group) => void;
  setGroups: (groups: Group[]) => void;
  setSelectedGroup: (group: Group | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  getGroup: (groupId: string) => Group | undefined;
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  selectedGroup: null,
  isLoading: false,
  error: null,
  addGroup: (group) =>
    set((state) => ({
      groups: [group, ...state.groups.filter((g) => g.id !== group.id)],
    })),
  removeGroup: (groupId) =>
    set((state) => ({
      groups: state.groups.filter((g) => g.id !== groupId),
    })),
  updateGroup: (group) =>
    set((state) => ({
      groups: state.groups.map((g) => (g.id === group.id ? group : g)),
    })),
  setGroups: (groups) => set({ groups }),
  setSelectedGroup: (group) => set({ selectedGroup: group }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  getGroup: (groupId) => get().groups.find((g) => g.id === groupId),
}));

// ========== UI STORE ==========

interface UIState {
  activeTab: 'chats' | 'contacts' | 'calls' | 'settings';
  isModalVisible: boolean;
  modalType: 'newChat' | 'newGroup' | 'call' | null;
  toastMessage: string | null;
  setActiveTab: (tab: 'chats' | 'contacts' | 'calls' | 'settings') => void;
  setModalVisible: (visible: boolean, type?: 'newChat' | 'newGroup' | 'call' | null) => void;
  showToast: (message: string, duration?: number) => void;
  clearToast: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: 'chats',
  isModalVisible: false,
  modalType: null,
  toastMessage: null,
  setActiveTab: (activeTab) => set({ activeTab }),
  setModalVisible: (isModalVisible, modalType = null) => set({ isModalVisible, modalType }),
  showToast: (toastMessage, duration = 3000) => {
    set({ toastMessage });
    setTimeout(() => set({ toastMessage: null }), duration);
  },
  clearToast: () => set({ toastMessage: null }),
}));

// ========== CALL STORE (WebRTC) ==========

interface CallState {
  activeCallId: string | null;
  callDetails: {
    contactPhoneHash: string;
    contactName: string;
    isVideoEnabled: boolean;
    isAudioEnabled: boolean;
    startTime: Date | null;
  } | null;
  startCall: (contactPhoneHash: string, contactName: string, isVideo?: boolean) => void;
  endCall: () => void;
  toggleVideo: (enabled: boolean) => void;
  toggleAudio: (enabled: boolean) => void;
}

export const useCallStore = create<CallState>((set) => ({
  activeCallId: null,
  callDetails: null,
  startCall: (contactPhoneHash, contactName, isVideo = false) =>
    set({
      activeCallId: Math.random().toString(36).substring(7),
      callDetails: {
        contactPhoneHash,
        contactName,
        isVideoEnabled: isVideo,
        isAudioEnabled: true,
        startTime: new Date(),
      },
    }),
  endCall: () => set({ activeCallId: null, callDetails: null }),
  toggleVideo: (isVideoEnabled) =>
    set((state) => ({
      callDetails: state.callDetails ? { ...state.callDetails, isVideoEnabled } : null,
    })),
  toggleAudio: (isAudioEnabled) =>
    set((state) => ({
      callDetails: state.callDetails ? { ...state.callDetails, isAudioEnabled } : null,
    })),
}));
