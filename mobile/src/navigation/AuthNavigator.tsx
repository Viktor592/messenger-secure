import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../types';

// Auth screens
import PhoneInputScreen from '../screens/Auth/PhoneInputScreen';
import CodeVerificationScreen from '../screens/Auth/CodeVerificationScreen';
import PinSetupScreen from '../screens/Auth/PinSetupScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
      }}
    >
      <Stack.Screen name="PhoneInput" component={PhoneInputScreen} />
      <Stack.Screen name="CodeVerification" component={CodeVerificationScreen} />
      <Stack.Screen name="PinSetup" component={PinSetupScreen} />
    </Stack.Navigator>
  );
}

export default AuthStack;
