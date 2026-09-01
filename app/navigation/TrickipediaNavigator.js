import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import TrickipediaDetailScreen from '../screens/TrickipediaDetailScreen';
import TrickipediaScreen from '../screens/TrickipediaScreen';

const Stack = createNativeStackNavigator();

export default function TrickipediaNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Trickipedia Library" component={TrickipediaScreen} />
      <Stack.Screen
        name="Trickipedia Lesson"
        component={TrickipediaDetailScreen}
        options={({ route }) => ({ title: route.params?.trick?.name || 'Trick lesson' })}
      />
    </Stack.Navigator>
  );
}

