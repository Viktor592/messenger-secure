import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMessageStore } from '../../utils/store';

const ChatDetailScreen: React.FC<any> = ({ navigation, route }) => {
  const { contactPhoneHash, displayName } = route.params;
  const [messageText, setMessageText] = useState('');
  const messages = useMessageStore((state) => state.getConversation(contactPhoneHash));

  const handleSendMessage = () => {
    if (!messageText.trim()) return;
    // Send encrypted message
    setMessageText('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.messageItem, { alignItems: item.fromPhoneHash === 'self' ? 'flex-end' : 'flex-start' }]}>
            <View
              style={[
                styles.messageBubble,
                item.fromPhoneHash === 'self' ? styles.messageBubbleOwn : styles.messageBubbleOther,
              ]}
            >
              <Text style={styles.messageText}>{item.encryptedBlob.substring(0, 100)}</Text>
            </View>
          </View>
        )}
        inverted
        contentContainerStyle={styles.messagesList}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Message..."
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxHeight={100}
          />
          <TouchableOpacity
            style={[styles.sendButton, !messageText.trim() && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!messageText.trim()}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  messageItem: {
    marginVertical: 6,
    width: '100%',
  },
  messageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    maxWidth: '80%',
  },
  messageBubbleOwn: {
    backgroundColor: '#007AFF',
  },
  messageBubbleOther: {
    backgroundColor: '#E5E5EA',
  },
  messageText: {
    fontSize: 14,
    color: '#000',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#CCC',
  },
  sendButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
});

export default ChatDetailScreen;
