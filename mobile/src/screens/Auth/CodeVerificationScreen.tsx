import React, { useState, useRef, useEffect } from 'react';
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

type CodeVerificationScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  'CodeVerification'
>;

const CodeVerificationScreen: React.FC<CodeVerificationScreenProps> = ({
  navigation,
  route,
}) => {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const inputRef = useRef<TextInput>(null);

  const { phoneHash, sessionToken } = route.params;

  useEffect(() => {
    // Auto-focus input
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    // Resend countdown timer
    let interval: NodeJS.Timeout;
    if (resendCountdown > 0) {
      interval = setInterval(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendCountdown]);

  const handleCodeChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 6);
    setCode(cleaned);

    // Auto-submit when 6 digits entered
    if (cleaned.length === 6) {
      verifyCode(cleaned);
    }
  };

  const verifyCode = async (codeToVerify: string) => {
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('http://YOUR_SERVER:3000/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneHash,
          sessionToken,
          code: codeToVerify,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid verification code');
      }

      // Navigate to PIN setup
      navigation.navigate('PinSetup', {
        phoneHash,
        sessionToken,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setCode('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('http://YOUR_SERVER:3000/api/auth/resend-code', {
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
        throw new Error(data.error || 'Failed to resend code');
      }

      setResendCountdown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
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
          <Text style={styles.title}>Verify Your Phone</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code we sent to your phone
          </Text>
        </View>

        {/* Code input */}
        <View style={styles.inputContainer}>
          <View style={styles.codeInputWrapper}>
            <TextInput
              ref={inputRef}
              style={styles.codeInput}
              placeholder="000000"
              placeholderTextColor="#CCC"
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={handleCodeChange}
              editable={!isLoading}
              textAlign="center"
            />
          </View>

          {/* Error message */}
          {error && <Text style={styles.errorText}>{error}</Text>}

          {/* Info text */}
          <Text style={styles.infoText}>
            Code valid for 10 minutes. Check your SMS for the 6-digit code.
          </Text>
        </View>

        {/* Verify button */}
        <TouchableOpacity
          style={[styles.verifyButton, !code || isLoading ? styles.verifyButtonDisabled : {}]}
          onPress={() => verifyCode(code)}
          disabled={code.length !== 6 || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.verifyButtonText}>Verify</Text>
          )}
        </TouchableOpacity>

        {/* Resend code */}
        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>Didn't receive a code?</Text>
          <TouchableOpacity
            onPress={handleResendCode}
            disabled={resendCountdown > 0 || isLoading}
          >
            <Text
              style={[
                styles.resendLink,
                resendCountdown > 0 ? styles.resendLinkDisabled : {},
              ]}
            >
              {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend Code'}
            </Text>
          </TouchableOpacity>
        </View>
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
  codeInputWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  codeInput: {
    fontSize: 40,
    fontWeight: '600',
    color: '#000',
    letterSpacing: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
    width: '100%',
    paddingVertical: 16,
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
  verifyButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 30,
  },
  verifyButtonDisabled: {
    backgroundColor: '#CCC',
  },
  verifyButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  resendLink: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  resendLinkDisabled: {
    color: '#CCC',
  },
});

export default CodeVerificationScreen;
