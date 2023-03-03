import React, { useContext, useEffect } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import Icon from '../components/Icon';
import { useNavigation } from '@react-navigation/native';

import ListItem from '../components/ListItem';
import ListItemSeperator from '../components/ListItemSeperator';
import Screen from '../components/Screen';
import colors from '../config/colors';
import routes from '../navigation/routes';
import AuthContext from '../auth/context';
import authStorage from '../auth/storage';
import usersAPI from '../api/users'
import imageAPI from '../api/image'

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

function AccountScreen() {
    const {user, setUser} = useContext(AuthContext);
    const navigation = useNavigation();
    const handleLogout = () =>{
        setUser(null);
        authStorage.removeToken();
    }
    // const loadImage = async() =>{
    //     try{
    //         //the image ref should actually already be available in the user object
    //         console.log(user);
    //         //const image = await imageAPI.getImage("blank-profile-picture.webp");
    //         //console.log(image.data);
    //         //Then call the api again to fetch image

    //     }
    //     catch(error){
    //         console.log(error, "could not fetch user");
    //     }
    // }
    // useEffect(() => {
    //     loadImage();
    // }, []);
    return (
        <Screen style={styles.screen}>
            <View>
                <ListItem 
                title={user.name}
                subTitle={user.email}
                image={{uri: user.imageUri}}
                onPress={() => navigation.navigate("Edit Account")}/>
                <View style={styles.container}>
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
                    />
                </View>
                <ListItem 
                title={"Log Out"} 
                IconComponent={<Icon name="logout" backgroundColor={colors.secondary} />}
                onPress={handleLogout}/>
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