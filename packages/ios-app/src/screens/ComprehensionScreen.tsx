import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal } from 'react-native';
import { comprehensionApi, GeneratedText, CharacterInfo } from '../api/client';

export default function ComprehensionScreen() {
  const [username] = useState('user1'); // TODO: Get from settings
  const [chapterStart, setChapterStart] = useState(1);
  const [chapterEnd, setChapterEnd] = useState(10);
  const [text, setText] = useState<GeneratedText | null>(null);
  const [selectedChar, setSelectedChar] = useState<CharacterInfo | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const generateText = async () => {
    setLoading(true);
    try {
      const response = await comprehensionApi.generate(username, chapterStart, chapterEnd);
      setText(response.data);
    } catch (error) {
      console.error('Failed to generate text:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCharacterPress = async (char: string) => {
    setLoading(true);
    try {
      const response = await comprehensionApi.getCharacterInfo(username, char);
      setSelectedChar(response.data);
      setModalVisible(true);
    } catch (error) {
      console.error('Failed to get character info:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={generateText} disabled={loading}>
        <Text style={styles.buttonText}>Generate Text</Text>
      </TouchableOpacity>

      {text && (
        <ScrollView style={styles.textContainer}>
          <View style={styles.chineseText}>
            {text.chineseText.split('').map((char, index) => (
              <TouchableOpacity key={index} onPress={() => handleCharacterPress(char)}>
                <Text style={styles.character}>{char}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.pinyin}>{text.pinyin}</Text>
        </ScrollView>
      )}

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {selectedChar && (
              <>
                <Text style={styles.modalCharacter}>{selectedChar.chineseCharacter}</Text>
                <Text style={styles.modalText}>Pinyin: {selectedChar.pinyin}</Text>
                {selectedChar.hanVietnamese && (
                  <Text style={styles.modalText}>Han Vietnamese: {selectedChar.hanVietnamese}</Text>
                )}
                {selectedChar.modernVietnamese && (
                  <Text style={styles.modalText}>Vietnamese: {selectedChar.modernVietnamese}</Text>
                )}
                {selectedChar.englishMeaning && (
                  <Text style={styles.modalText}>English: {selectedChar.englishMeaning}</Text>
                )}
                {selectedChar.learningNote && (
                  <Text style={styles.modalText}>Note: {selectedChar.learningNote}</Text>
                )}
              </>
            )}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  button: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    fontWeight: '600',
  },
  textContainer: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
  },
  chineseText: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  character: {
    fontSize: 32,
    padding: 5,
  },
  pinyin: {
    fontSize: 16,
    color: '#7f8c8d',
    lineHeight: 24,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 30,
    width: '80%',
  },
  modalCharacter: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalText: {
    fontSize: 18,
    marginBottom: 10,
  },
  closeButton: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
  },
});
