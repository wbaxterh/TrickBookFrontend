import React, { useContext, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import AppText from '../components/AppText';
import Screen from '../components/Screen';
import AppButton from '../components/AppButton';
import colors from '../config/colors';
import usersAPI from '../api/users'
import AuthContext from '../auth/context';
import authStorage from '../auth/storage';

function SettingsScreen({navigation}) {
    const {user, setUser} = useContext(AuthContext);
    function handleLogout(){
        setUser(null);
        authStorage.removeToken();
    }
    const handleDelete = async() => {
        Alert.alert("Delete User", "Do you want to permanently delete your account?", [
            {
                text: "Cancel",
                onPress: () => console.log("Cancel Pressed"),
                style: "cancel"
              },
              { text: "OK", onPress: async () => {
                //Delete user and logout
                const deleted = await usersAPI.deleteUser(user.userId)
                if(deleted.status == 200){
                   handleLogout();
                }
            }
            }
        ])
        
        
       }
    return (
        <Screen style={styles.container}>
            <AppButton title="Change Picture" onPress={() => navigation.navigate("Edit Account")} foregroundColor={colors.dark} backgroundColor={colors.light}  />
            <AppButton title="Delete Account" onPress={handleDelete} foregroundColor={colors.white} backgroundColor={colors.red} />
        </Screen>
    );
}
const styles = StyleSheet.create({
    container:{
        margin: 10
    },
    description:{
        fontWeight: '800'
    }
})
export default SettingsScreen;