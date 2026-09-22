import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { useAuthStore } from '../../utils/store';

const SettingsScreen: React.FC = () => {
  const { user, clearAuth } = useAuthStore();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', onPress: () => {} },
      {
        text: 'Logout',
        onPress: () => clearAuth(),
        style: 'destructive',
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Account section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Display Name</Text>
            <Text style={styles.value}>{user?.displayName || 'Unknown'}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Fingerprint</Text>
            <Text style={[styles.value, styles.fingerprint]}>
              {user?.identityKeyFingerprint}
            </Text>
          </View>
        </View>

        {/* Privacy section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & Security</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <Text style={styles.label}>End-to-End Encryption</Text>
              <Text style={styles.badge}>ON</Text>
            </View>
          </View>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <Text style={styles.label}>Notifications</Text>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
              />
            </View>
          </View>
        </View>

        {/* Appearance section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <Text style={styles.label}>Dark Mode</Text>
              <Switch value={darkMode} onValueChange={setDarkMode} />
            </View>
          </View>
        </View>

        {/* About section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Version</Text>
            <Text style={styles.value}>0.1.0-alpha</Text>
          </View>
          <TouchableOpacity style={styles.card}>
            <Text style={styles.link}>View Source Code</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.card}>
            <Text style={styles.link}>Privacy Policy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.card}>
            <Text style={styles.link}>Terms of Service</Text>
          </TouchableOpacity>
        </View>

        {/* Logout button */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  value: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  fingerprint: {
    fontFamily: 'monospace',
    fontSize: 11,
  },
  badge: {
    backgroundColor: '#34C759',
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  link: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SettingsScreen;
