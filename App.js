import React, { useState, useEffect } from 'react';
import { Image, Platform, SafeAreaView, StyleSheet, Text, View, Button} from 'react-native';
import Screen from './app/components/Screen';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WelcomeScreen from './app/screens/WelcomeScreen'
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import colors from './app/config/colors';
import AccountScreen from './app/screens/AccountScreen';
import TrickListScreen from './app/screens/TrickListScreen';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import AuthNavigator from './app/navigation/AuthNavigator';
import LoginScreen from './app/screens/LoginScreen';
import RegisterScreen from './app/screens/RegisterScreen';
import navigationTheme from './app/navigation/navigationTheme';
import AppNavigator from './app/navigation/AppNavigator';
import CreateTrickListScreen from './app/screens/CreateTrickListScreen';
import ListTrickListsScreen from './app/screens/ListTrickListsScreen';
import EditTrickScreen from './app/screens/EditTrickScreen';
import TrickNavigator from './app/navigation/TrickNavigator';
import AuthContext from './app/auth/context';
import authStorage from './app/auth/storage';
import jwtDecode from 'jwt-decode';
import AppLoading from 'expo';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();
export default function App() {
  const Stack = createNativeStackNavigator();
  const Tab = createBottomTabNavigator();
  const [user, setUser] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const restoreToken = async () => {
   const token = await authStorage.getToken();
   if(!token) return setIsReady(true);
    setUser(jwtDecode(token));
    setIsReady(true);
  }
  useEffect(() => {
     restoreToken();
  }, []);
if(!isReady){
  return null;
}
else{
  SplashScreen.hideAsync();
  return (
    <AuthContext.Provider value={{user, setUser}}>
      <NavigationContainer theme={navigationTheme}>
        {user ?<AppNavigator />:
        <AuthNavigator/>}
        
      </NavigationContainer>
    </AuthContext.Provider>
  );
}
}

const styles = StyleSheet.create({

});
