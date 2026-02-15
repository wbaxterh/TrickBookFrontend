import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';
import jwtDecode from 'jwt-decode';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import AuthContext from './app/auth/context';
import authStorage from './app/auth/storage';
import AppNavigator from './app/navigation/AppNavigator';
import AuthNavigator from './app/navigation/AuthNavigator';
import GuestNavigator from './app/navigation/GuestNavigator';
import navigationTheme from './app/navigation/navigationTheme';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const _Stack = createNativeStackNavigator();
  const _Tab = createBottomTabNavigator();
  const [user, setUser] = useState(0);
  const [guest, setGuest] = useState();
  const [isReady, setIsReady] = useState(false);

  const restoreToken = async () => {
    const token = await authStorage.getToken();
    if (!token) {
      // setGuest(true);
    } else {
      setUser(jwtDecode(token));
    }
    setIsReady(true);
  };

  useEffect(() => {
    restoreToken();
  }, [restoreToken]);

  if (!isReady) {
    return null;
  } else {
    SplashScreen.hideAsync();
    return (
      <AuthContext.Provider value={{ user, setUser, guest, setGuest }}>
        <NavigationContainer theme={navigationTheme}>
          {user ? <AppNavigator /> : guest ? <GuestNavigator /> : <AuthNavigator />}
        </NavigationContainer>
      </AuthContext.Provider>
    );
  }
}
const _styles = StyleSheet.create({});
