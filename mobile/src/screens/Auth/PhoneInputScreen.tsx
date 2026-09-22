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

type PhoneInputScreenProps = NativeStackScreenProps<AuthStackParamList, 'PhoneInput'>;

const PhoneInputScreen: React.FC<PhoneInputScreenProps> = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendCode = async () => {
    setError('');
    setIsLoading(true);

    try {
      // Validate phone number
      const cleaned = phoneNumber.replace(/\D/g, '');
      if (cleaned.length < 10) {
        throw new Error('Invalid phone number');
      }

      // Format: +7XXXXXXXXXXX or +1XXXXXXXXXX
      const formatted = cleaned.startsWith('7') || cleaned.startsWith('1')
        ? '+' + cleaned
        : '+7' + cleaned;

      // Call backend API to send SMS
      const response = await fetch('http://YOUR_SERVER:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: formatted }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send SMS code');
      }

      // Navigate to code verification
      navigation.navigate('CodeVerification', {
        phoneHash: data.data.phoneHash,
        sessionToken: data.data.sessionToken,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneChange = (text: string) => {
    // Format phone number as user types
    const cleaned = text.replace(/\D/g, '');
    let formatted = cleaned;

    if (cleaned.length > 0) {
      if (cleaned.length <= 3) {
        formatted = cleaned;
      } else if (cleaned.length <= 6) {
        formatted = cleaned.slice(0, 3) + ' ' + cleaned.slice(3);
      } else {
        formatted = cleaned.slice(0, 3) + ' ' + cleaned.slice(3, 6) + ' ' + cleaned.slice(6, 10);
      }
    }

    setPhoneNumber(formatted);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Messenger Secure</Text>
          <Text style={styles.subtitle}>Enter your phone number to get started</Text>
        </View>

        {/* Phone input */}
        <View style={styles.inputContainer}>
          <View style={styles.phoneInputWrapper}>
            <Text style={styles.countryCode}>+7</Text>
            <TextInput
              style={styles.phoneInput}
              placeholder="900 123 4567"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
              maxLength={14}
              value={phoneNumber}
              onChangeText={handlePhoneChange}
              editable={!isLoading}
            />
          </View>

          {/* Error message */}
          {error && <Text style={styles.errorText}>{error}</Text>}

          {/* Info text */}
          <Text style={styles.infoText}>
            We'll send you a 6-digit code to verify your number. Standard SMS rates may apply.
          </Text>
        </View>

        {/* Send button */}
        <TouchableOpacity
          style={[styles.sendButton, !phoneNumber || isLoading ? styles.sendButtonDisabled : {}]}
          onPress={handleSendCode}
          disabled={!phoneNumber || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.sendButtonText}>Send Code</Text>
          )}
        </TouchableOpacity>

        {/* Privacy notice */}
        <Text style={styles.privacyText}>
          By continuing, you agree to our Terms of Service and Privacy Policy. We never share
          your phone number.
        </Text>
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
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
    marginBottom: 16,
  },
  countryCode: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginRight: 8,
  },
  phoneInput: {
    flex: 1,
    fontSize: 18,
    color: '#000',
    paddingVertical: 12,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#999',
    marginTop: 16,
    lineHeight: 18,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 30,
  },
  sendButtonDisabled: {
    backgroundColor: '#CCC',
  },
  sendButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  privacyText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default PhoneInputScreen;
