import { useEffect, useCallback, useState } from 'react';
import { useAuthStore } from './store';
import ApiClient from './api-client';

/**
 * Глобальный API client экземпляр
 * Инициализируется один раз при запуске app
 */
let globalApiClient: ApiClient | null = null;

/**
 * Инициализировать API client
 */
export const initializeApiClient = (baseUrl: string = 'http://localhost:3000') => {
  if (!globalApiClient) {
    globalApiClient = new ApiClient({
      baseUrl,
      timeout: 30000,
      onUnauthorized: () => {
        // Clear auth on 401
        useAuthStore.getState().clearAuth();
      },
    });
  }
  return globalApiClient;
};

/**
 * Получить API client
 */
export const getApiClient = (): ApiClient => {
  if (!globalApiClient) {
    globalApiClient = initializeApiClient();
  }
  return globalApiClient;
};

// ========== AUTH HOOKS ==========

/**
 * Hook для SMS регистрации
 */
export const useSendSmsCode = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = useCallback(
    async (phone: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const api = getApiClient();
        const result = await api.registerPhoneNumber(phone);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { sendCode, isLoading, error };
};

/**
 * Hook для верификации SMS кода
 */
export const useVerifyCode = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setUser, setSession } = useAuthStore();

  const verifyCode = useCallback(
    async (phoneHash: string, sessionToken: string, code: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const api = getApiClient();
        const result = await api.verifyCode(phoneHash, sessionToken, code);
        
        setUser(result.user);
        setSession({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresAt: result.expiresAt,
        });

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [setUser, setSession]
  );

  return { verifyCode, isLoading, error };
};

/**
 * Hook для логаута
 */
export const useLogout = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { clearAuth } = useAuthStore();

  const logout = useCallback(async () => {
    setIsLoading(true);

    try {
      const api = getApiClient();
      await api.logout();
      clearAuth();
    } catch (err) {
      console.error('Logout error:', err);
      // Clear auth even if API call fails
      clearAuth();
    } finally {
      setIsLoading(false);
    }
  }, [clearAuth]);

  return { logout, isLoading };
};

// ========== CONTACT HOOKS ==========

/**
 * Hook для поиска контакта
 */
export const useSearchContact = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (phone: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const api = getApiClient();
      return await api.searchContact(phone);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { search, isLoading, error };
};

/**
 * Hook для добавления контакта
 */
export const useAddContact = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addContact } = useContactStore();

  const add = useCallback(
    async (phoneHash: string, displayName: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const api = getApiClient();
        const contact = await api.addContact(phoneHash, displayName);
        addContact(contact);
        return contact;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [addContact]
  );

  return { add, isLoading, error };
};

// ========== MESSAGE HOOKS ==========

/**
 * Hook для получения offline сообщений
 */
export const usePendingMessages = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const api = getApiClient();
      return await api.getPendingMessages();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { fetchPending, isLoading, error };
};

/**
 * Hook для удаления сообщения
 */
export const useDeleteMessage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteMessage = useCallback(async (messageId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const api = getApiClient();
      await api.deleteMessage(messageId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { deleteMessage, isLoading, error };
};

// ========== GROUP HOOKS ==========

/**
 * Hook для создания группы
 */
export const useCreateGroup = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (name: string, memberPhoneHashes: string[]) => {
    setIsLoading(true);
    setError(null);

    try {
      const api = getApiClient();
      return await api.createGroup(name, memberPhoneHashes);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { create, isLoading, error };
};

/**
 * Hook для загрузки списка групп
 */
export const useGroups = () => {
  const [groups, setGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const api = getApiClient();
      const result = await api.listGroups();
      setGroups(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { groups, fetchGroups, isLoading, error };
};

// ========== HEALTH HOOK ==========

/**
 * Hook для проверки подключения к серверу
 */
export const useHealthCheck = () => {
  const [status, setStatus] = useState<'idle' | 'checking' | 'connected' | 'failed'>('idle');
  const [version, setVersion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    setStatus('checking');
    setError(null);

    try {
      const api = getApiClient();
      const result = await api.healthCheck();
      setVersion(result.version);
      setStatus('connected');
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setStatus('failed');
      throw err;
    }
  }, []);

  // Auto-check on mount
  useEffect(() => {
    check();
  }, [check]);

  return { status, version, error, check };
};

// Импорты для периспользования
import { useContactStore } from './store';
