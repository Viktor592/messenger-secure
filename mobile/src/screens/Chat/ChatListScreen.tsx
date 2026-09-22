import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMessageStore } from '../../utils/store';

const ChatListScreen: React.FC<any> = ({ navigation }) => {
  const messages = useMessageStore((state) => state.messages);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load conversations
    setIsLoading(false);
  }, []);

  const conversations = Object.entries(messages)
    .map(([phoneHash, msgs]) => ({
      phoneHash,
      lastMessage: msgs[msgs.length - 1],
      unreadCount: msgs.filter((m) => !m.isRead).length,
    }))
    .sort((a, b) => (b.lastMessage?.timestamp || 0) > (a.lastMessage?.timestamp || 0) ? 1 : -1);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.phoneHash}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.conversationItem}
            onPress={() =>
              navigation.navigate('ChatDetail', {
                contactPhoneHash: item.phoneHash,
                displayName: item.lastMessage?.fromPhoneHash || 'Unknown',
              })
            }
          >
            <View style={styles.conversationContent}>
              <Text style={styles.conversationName}>{item.phoneHash}</Text>
              <Text style={styles.conversationPreview} numberOfLines={1}>
                {item.lastMessage?.encryptedBlob.substring(0, 50)}...
              </Text>
            </View>
            {item.unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No conversations yet</Text>
            <Text style={styles.emptySubtext}>Start a new conversation from Contacts</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  conversationItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    alignItems: 'center',
  },
  conversationContent: {
    flex: 1,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  conversationPreview: {
    fontSize: 14,
    color: '#999',
  },
  badge: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#CCC',
  },
});

export default ChatListScreen;
