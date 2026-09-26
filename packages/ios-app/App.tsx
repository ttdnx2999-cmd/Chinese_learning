import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from './src/screens/HomeScreen';
import FlashcardScreen from './src/screens/FlashcardScreen';
import ComprehensionScreen from './src/screens/ComprehensionScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen 
          name="Home" 
          component={HomeScreen}
          options={{ title: 'Chinese Learning' }}
        />
        <Stack.Screen 
          name="Flashcard" 
          component={FlashcardScreen}
          options={{ title: 'Flashcards' }}
        />
        <Stack.Screen 
          name="Comprehension" 
          component={ComprehensionScreen}
          options={{ title: 'Text Comprehension' }}
        />
        <Stack.Screen 
          name="Settings" 
          component={SettingsScreen}
          options={{ title: 'Settings' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
