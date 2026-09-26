import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

export default function SettingsScreen() {
  const [username, setUsername] = useState('user1');
  const [chapterStart, setChapterStart] = useState('1');
  const [chapterEnd, setChapterEnd] = useState('10');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      
      <View style={styles.field}>
        <Text style={styles.label}>Username:</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="Enter username"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Chapter Range:</Text>
        <View style={styles.rangeContainer}>
          <TextInput
            style={[styles.input, styles.rangeInput]}
            value={chapterStart}
            onChangeText={setChapterStart}
            keyboardType="numeric"
            placeholder="Start"
          />
          <Text style={styles.rangeSeparator}>to</Text>
          <TextInput
            style={[styles.input, styles.rangeInput]}
            value={chapterEnd}
            onChangeText={setChapterEnd}
            keyboardType="numeric"
            placeholder="End"
          />
        </View>
      </View>

      <Text style={styles.note}>
        Note: Settings are stored locally. Username is used to access your vocabulary on the server.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  rangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rangeInput: {
    flex: 1,
  },
  rangeSeparator: {
    marginHorizontal: 10,
    fontSize: 16,
  },
  note: {
    marginTop: 30,
    fontSize: 14,
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
});
