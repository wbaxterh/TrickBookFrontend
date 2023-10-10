import React, { useContext, useEffect } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import Icon from '../components/Icon';
import { useNavigation } from '@react-navigation/native';

import ListItem from '../components/ListItem';
import ListItemSeperator from '../components/ListItemSeperator';
import Screen from '../components/Screen';
import colors from '../config/colors';
import routes from '../navigation/routes';
import AuthContext from '../auth/context';
import authStorage from '../auth/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const menuItems = [
    {
        title: "Trick Lists",
        icon: {
            name: "format-list-bulleted",
            backgroundColor: colors.secondary
        },
        targetScreen: routes.TRICKLISTS
    },
    {
        title: "My Stats",
        icon: {
            name: "trending-up",
            backgroundColor: colors.secondary
        },
        targetScreen: routes.STATS
    }
];
const subMenuItems = [
    {
        title: "Settings",
        icon: {
            name: "account-settings",
            backgroundColor: colors.medium
        },
        targetScreen: routes.SETTINGS
    },
    {
        title: "Log Out",
        icon: {
            name: "logout",
            backgroundColor: colors.medium
        }
    }
];

function AccountScreen() {
    const {user, setUser} = useContext(AuthContext);
    const {guest, setGuest} = useContext(AuthContext);
    const navigation = useNavigation();
    const handleLogout = () =>{
        if(!guest){
            setUser(0);
            authStorage.removeToken();
        }
        else{
            setGuest(null);
        }
    }
    const clearAsyncStorage = async () => {
        Alert.alert("Delete List", "Delete your trick list?", [
            {
                text: "Cancel",
                onPress: () => console.log("Cancel Pressed"),
                style: "cancel"
              },
              { text: "OK", onPress: async () =>
              {
                try {
                await AsyncStorage.clear();
                //console.log('Async storage has been cleared!');
                } catch (e) {
                console.error(e);
                }
            }
        }
    ])
      }
    return (
        <Screen style={styles.screen}>
            <View>
                <ListItem 
                title={user? user.name : "Guest"}
                subTitle={!guest ? user.email : <></>}
                image={{uri: user.imageUri ? user.imageUri : 'https://trickbook.s3.amazonaws.com/blank-profile-picture.webp'}}
                onPress={() => user? navigation.navigate("Edit Account") : <></>}/>
                <View style={styles.container}>
                    {user ? 
                    <FlatList 
                        data={menuItems}
                        keyExtractor={menuItem => menuItem.title}
                        ItemSeparatorComponent={ListItemSeperator}
                        renderItem={({item}) => (
                            <ListItem 
                            title={item.title}
                            onPress={() => navigation.navigate(item.targetScreen)}
                            IconComponent={<Icon name={item.icon.name} backgroundColor={item.icon.backgroundColor}/>}
                            />
                        )}
                    />:<><ListItem 
                    title={"Trick List"}
                    onPress={() => navigation.navigate(routes.GUESTTRICKS)}
                    IconComponent={<Icon name={"format-list-bulleted"} backgroundColor={colors.secondary}/>}
                    />
                    <ListItem
                    title={"Delete List"}
                    onPress={clearAsyncStorage}
                    IconComponent={<Icon name={"delete"} backgroundColor={colors.red}/>}
                       /></>
                    }
                </View>
                <View style={styles.container}>
                    {user ? 
                    <FlatList 
                        data={subMenuItems}
                        keyExtractor={menuItem => menuItem.title}
                        ItemSeparatorComponent={ListItemSeperator}
                        renderItem={({item}) => (
                            <ListItem 
                            title={item.title}
                            onPress={item.targetScreen ? () => navigation.navigate(item.targetScreen) : handleLogout}
                            IconComponent={<Icon name={item.icon.name} backgroundColor={item.icon.backgroundColor}/>}
                            />
                        )}
                        /> :
                        <ListItem 
                            title={"Logout"}
                            onPress={handleLogout}
                            IconComponent={<Icon name={"logout"} backgroundColor={colors.medium}/>}
                            />
                    }
                </View>
            </View>
        </Screen>
    );
}
const styles = StyleSheet.create({
    screen:{
        backgroundColor: colors.light
    },
    container:{
        marginVertical: 40
    }
})
export default AccountScreen;