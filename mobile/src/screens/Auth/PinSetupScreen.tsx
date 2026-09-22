import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types';
import { useAuthStore } from '../../utils/store';
import EncryptedStorage from '../../storage/encrypted-storage';
import NoiseProtocol from '../../crypto/noise-client';

type PinSetupScreenProps = NativeStackScreenProps<AuthStackParamList, 'PinSetup'>;

const PinSetupScreen: React.FC<PinSetupScreenProps> = ({ route, navigation }) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { setUser, setSession } = useAuthStore();
  const { phoneHash, sessionToken } = route.params;

  const handlePinChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 4);
    if (step === 'create') {
      setPin(cleaned);
    } else {
      setConfirmPin(cleaned);
    }
  };

  const handleNext = () => {
    if (step === 'create') {
      if (pin.length !== 4) {
        setError('PIN must be 4 digits');
        return;
      }
      setStep('confirm');
      setError('');
    } else {
      if (confirmPin.length !== 4) {
        setError('PIN must be 4 digits');
        return;
      }
      if (pin !== confirmPin) {
        setError('PINs do not match');
        setConfirmPin('');
        return;
      }
      completePinSetup();
    }
  };

  const completePinSetup = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Complete auth on backend
      const response = await fetch('http://YOUR_SERVER:3000/api/auth/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneHash,
          sessionToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete authentication');
      }

      // Initialize crypto
      const crypto = new NoiseProtocol();
      const keys = crypto.exportKeys();

      // Save to encrypted storage
      const storage = new EncryptedStorage();
      await storage.initialize();
      
      await storage.saveUser({
        id: data.data.user.id,
        phoneHash: data.data.user.phoneHash,
        displayName: data.data.user.displayName,
        publicKey: data.data.user.publicKey,
        identityKeyFingerprint: data.data.user.identityKeyFingerprint,
        createdAt: new Date(data.data.user.createdAt),
        updatedAt: new Date(data.data.user.updatedAt),
      });

      await storage.saveDeviceKeys(keys);

      // Update global auth state
      setUser(data.data.user);
      setSession({
        accessToken: data.data.accessToken,
        refreshToken: data.data.refreshToken,
        expiresAt: data.data.expiresAt,
      });

      // Navigation happens automatically via RootNavigator
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'confirm') {
      setStep('create');
      setConfirmPin('');
      setError('');
    } else {
      navigation.goBack();
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {step === 'create' ? 'Create a PIN' : 'Confirm PIN'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'create'
              ? 'Set a 4-digit PIN to protect your app'
              : 'Enter the same PIN to confirm'}
          </Text>
        </View>

        {/* PIN input */}
        <View style={styles.inputContainer}>
          <View style={styles.pinInputWrapper}>
            <TextInput
              style={styles.pinInput}
              placeholder="0000"
              placeholderTextColor="#CCC"
              keyboardType="number-pad"
              maxLength={4}
              value={step === 'create' ? pin : confirmPin}
              onChangeText={handlePinChange}
              editable={!isLoading}
              textAlign="center"
              secureTextEntry
            />
          </View>

          {/* PIN indicators */}
          <View style={styles.pinIndicators}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  styles.pinDot,
                  (step === 'create' ? pin.length : confirmPin.length) > i
                    ? styles.pinDotFilled
                    : {},
                ]}
              />
            ))}
          </View>

          {/* Error message */}
          {error && <Text style={styles.errorText}>{error}</Text>}

          {/* Info text */}
          <Text style={styles.infoText}>
            {step === 'create'
              ? 'You will need this PIN every time you open the app'
              : 'Make sure you remember this PIN'}
          </Text>
        </View>

        {/* Next/Confirm button */}
        <TouchableOpacity
          style={[
            styles.nextButton,
            (step === 'create' ? pin.length !== 4 : confirmPin.length !== 4) || isLoading
              ? styles.nextButtonDisabled
              : {},
          ]}
          onPress={handleNext}
          disabled={
            (step === 'create' ? pin.length !== 4 : confirmPin.length !== 4) || isLoading
          }
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.nextButtonText}>
              {step === 'create' ? 'Next' : 'Confirm'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Back button */}
        <TouchableOpacity onPress={handleBack} disabled={isLoading}>
          <Text style={styles.backButton}>Back</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  inputContainer: {
    marginBottom: 30,
  },
  pinInputWrapper: {
    alignItems: 'center',
    marginBottom: 24,
  },
  pinInput: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
    width: '100%',
    paddingVertical: 16,
  },
  pinIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  pinDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E0E0E0',
  },
  pinDotFilled: {
    backgroundColor: '#007AFF',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 12,
    color: '#999',
    marginTop: 16,
    lineHeight: 18,
    textAlign: 'center',
  },
  nextButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  nextButtonDisabled: {
    backgroundColor: '#CCC',
  },
  nextButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 12,
  },
});

export default PinSetupScreen;
