import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import Trick from '../components/Trick';
import Screen from '../components/Screen';
import TrickDelete from '../components/TrickDelete';
import ListItemSeperator from '../components/ListItemSeperator';
import AsyncStorage from '@react-native-async-storage/async-storage';

function GuestTrickListScreen({navigation}) {
  const [guestTrickList, setGuestTrickList] = useState([]);
  useEffect(() => {
    loadTricks();
    const reload = navigation.addListener('focus', () => {
        // The screen is focused
        // Call the refresh function
        loadTricks();
      });
      // Return the unsubscribe function to clean up the listener
      return reload;
}, [navigation]);
    const loadTricks = async () => {
      try {
        const jsonValue = await AsyncStorage.getItem('@guest_trick_list');
        const tricks = jsonValue != null ? JSON.parse(jsonValue) : [];
        setGuestTrickList(tricks);
      } catch (e) {
        console.error('Failed to load guest trick list from AsyncStorage', e);
      }
    };
    const handleDelete = async (trick) => {
        try {
          const jsonValue = await AsyncStorage.getItem('@guest_trick_list');
          let guestList = jsonValue != null ? JSON.parse(jsonValue) : [];
      
          // Filter out the trick with the matching id
          guestList = guestList.filter((item) => item.id !== trick.id);
      
          // Save the updated guestList to AsyncStorage
          await AsyncStorage.setItem('@guest_trick_list', JSON.stringify(guestList));
          
          console.log(guestList);
          loadTricks();
        } catch (e) {
          console.error(e);
          alert('could not delete trick');
        }
      };
  return (
    <Screen style={styles.container}>
      <FlatList
        data={guestTrickList}
        keyExtractor={(trick) => trick.id}
        renderItem={({ item }) => (
          <Trick
            trick={item}
            name={item.name}
            checked={item.checked}
            onPress={() => console.log('Trick pressed', item)}
            renderRightActions={() => (<TrickDelete onPress={() => handleDelete(item)} />)}
          />
        )}
        ItemSeparatorComponent={ListItemSeperator}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 10,
  },
});

export default GuestTrickListScreen;