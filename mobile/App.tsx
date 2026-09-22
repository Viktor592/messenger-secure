import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAuthStore } from './src/utils/store';
import EncryptedStorage from './src/storage/encrypted-storage';

/**
 * Main App Component
 * Initializes encrypted storage and auth state
 */
function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const { setUser, setSession } = useAuthStore();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize encrypted storage
        const storage = new EncryptedStorage();
        await storage.initialize();

        // Try to load saved user and session
        const savedUser = await storage.getUser();
        const deviceKeys = await storage.getDeviceKeys();

        if (savedUser) {
          setUser(savedUser);
          // Note: Session would be refreshed on app startup
          // For now, user will need to login again
        }

        // Saved keys are available for crypto operations
        if (deviceKeys) {
          console.log('Device keys loaded from secure storage');
        }
      } catch (error) {
        console.error('Failed to initialize app:', error);
        // Continue anyway - user will login
      } finally {
        setIsInitializing(false);
      }
    };

    initializeApp();
  }, []);

  if (isInitializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return <RootNavigator />;
}

export default App;
