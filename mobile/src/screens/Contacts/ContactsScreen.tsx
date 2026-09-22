import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useContactStore } from '../../utils/store';

const ContactsScreen: React.FC<any> = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const contacts = useContactStore((state) => state.contacts);
  const searchContacts = useContactStore((state) => state.searchContacts);

  const filteredContacts = searchQuery ? searchContacts(searchQuery) : contacts;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredContacts}
        keyExtractor={(item) => item.phoneHash}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.contactItem}>
            <View style={styles.contactAvatar}>
              <Text style={styles.avatarText}>{item.displayName[0]}</Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{item.displayName}</Text>
              <Text style={styles.contactStatus}>{item.status}</Text>
            </View>
            <Text style={[styles.status, { color: item.status === 'online' ? '#34C759' : '#999' }]}>
              ●
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No contacts yet</Text>
            <Text style={styles.emptySubtext}>Add contacts to start messaging</Text>
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
  searchContainer: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchInput: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  contactItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    alignItems: 'center',
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  contactStatus: {
    fontSize: 12,
    color: '#999',
    textTransform: 'capitalize',
  },
  status: {
    fontSize: 16,
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

export default ContactsScreen;
