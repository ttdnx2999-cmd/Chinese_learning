import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { flashcardApi, Flashcard, FlashcardAnswer } from '../api/client';

export default function FlashcardScreen() {
  const [username] = useState('user1'); // TODO: Get from settings
  const [mode, setMode] = useState<'ChineseToMeanings' | 'EnglishToChinese' | 'VietnameseToChinese'>('ChineseToMeanings');
  const [chapterStart, setChapterStart] = useState(1);
  const [chapterEnd, setChapterEnd] = useState(10);
  const [flashcard, setFlashcard] = useState<Flashcard | null>(null);
  const [answer, setAnswer] = useState<FlashcardAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const loadNextCard = async () => {
    setLoading(true);
    setRevealed(false);
    setAnswer(null);
    try {
      const response = await flashcardApi.getNext(username, mode, chapterStart, chapterEnd);
      setFlashcard(response.data);
    } catch (error) {
      console.error('Failed to load flashcard:', error);
    } finally {
      setLoading(false);
    }
  };

  const revealAnswer = async () => {
    if (!flashcard) return;
    setLoading(true);
    try {
      const response = await flashcardApi.getAnswer(username, flashcard.id);
      setAnswer(response.data);
      setRevealed(true);
    } catch (error) {
      console.error('Failed to reveal answer:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNextCard();
  }, [mode]);

  if (loading && !flashcard) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.modeSelector}>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'ChineseToMeanings' && styles.modeButtonActive]}
          onPress={() => setMode('ChineseToMeanings')}
        >
          <Text style={styles.modeButtonText}>中→意</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'EnglishToChinese' && styles.modeButtonActive]}
          onPress={() => setMode('EnglishToChinese')}
        >
          <Text style={styles.modeButtonText}>En→中</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'VietnameseToChinese' && styles.modeButtonActive]}
          onPress={() => setMode('VietnameseToChinese')}
        >
          <Text style={styles.modeButtonText}>Vi→中</Text>
        </TouchableOpacity>
      </View>

      {flashcard && (
        <View style={styles.card}>
          <Text style={styles.question}>{flashcard.question.displayText}</Text>
          
          {revealed && answer && (
            <View style={styles.answer}>
              {answer.chinese && <Text style={styles.answerText}>Chinese: {answer.chinese}</Text>}
              {answer.pinyin && <Text style={styles.answerText}>Pinyin: {answer.pinyin}</Text>}
              {answer.hanVietnamese && <Text style={styles.answerText}>Han Vietnamese: {answer.hanVietnamese}</Text>}
              {answer.modernVietnamese && <Text style={styles.answerText}>Vietnamese: {answer.modernVietnamese}</Text>}
              {answer.englishMeaning && <Text style={styles.answerText}>English: {answer.englishMeaning}</Text>}
              {answer.learningNote && <Text style={styles.answerText}>Note: {answer.learningNote}</Text>}
            </View>
          )}
        </View>
      )}

      <View style={styles.actions}>
        {!revealed ? (
          <TouchableOpacity style={styles.button} onPress={revealAnswer} disabled={loading}>
            <Text style={styles.buttonText}>Show Answer</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.button} onPress={loadNextCard} disabled={loading}>
            <Text style={styles.buttonText}>Next Card</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  modeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  modeButton: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#ecf0f1',
    flex: 1,
    marginHorizontal: 5,
  },
  modeButtonActive: {
    backgroundColor: '#3498db',
  },
  modeButtonText: {
    textAlign: 'center',
    fontWeight: '600',
  },
  card: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  question: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  answer: {
    marginTop: 20,
    width: '100%',
  },
  answerText: {
    fontSize: 18,
    marginBottom: 10,
  },
  actions: {
    marginTop: 20,
  },
  button: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    fontWeight: '600',
  },
});
