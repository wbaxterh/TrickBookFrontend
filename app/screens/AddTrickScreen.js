import React, {useContext} from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Yup from 'yup';
import { AppForm, SubmitButton, AppFormField  } from '../components/forms';
import AuthContext from '../auth/context';
import Screen from '../components/Screen';
import colors from '../config/colors';
import trickApi from '../api/trick';
import routes from '../navigation/routes';
import AsyncStorage from '@react-native-async-storage/async-storage';

const validationSchema = Yup.object().shape({
    name: Yup.string().required().label("Name"),
})
function AddTrickScreen({route, navigation}) {
    const {user, setUser} = useContext(AuthContext);
    const {guest, setGuest} = useContext(AuthContext);
    let trickListId = 0;
    if(!guest){ 
        trickListId = route.params._id;
    }
    const handleSubmit = async(trick) =>{
        trick = { ...trick, checked: "To Do", list_id: trickListId };
        //console.log(trick);
        const result = await trickApi.addTrick(trick);
        if(!result.ok){
            alert('could not save trick');
        }
        else{
            // console.log("success");
            navigation.goBack();
        }
    }
    const handleSubmitGuest = async (trick) =>{
        try {
            const jsonValue = await AsyncStorage.getItem('@guest_trick_list');
            let guestList = jsonValue != null ? JSON.parse(jsonValue) : [];
            let id = 1;
            if (guestList.length > 0) {
                id = guestList[guestList.length - 1].id + 1;
            }
            
            const newTrick = {...trick, checked: "To Do", id};
            guestList.push(newTrick);
            await AsyncStorage.setItem('@guest_trick_list', JSON.stringify(guestList));
            //console.log(guestList);
            navigation.navigate(routes.GUESTTRICKS);
        } catch (e) {
            console.error(e);
            alert('could not save trick');
        }
    }
    return (
        <Screen style={styles.container}>
            <View style={styles.container}>
            <AppForm initialValues={{name: ''}} style={styles.container} onSubmit={!guest ? handleSubmit : handleSubmitGuest}
            validationSchema={validationSchema}>
                <AppFormField 
                autoCapitalize={"none"} 
                autoCorrect={false} 
                keyboardType={"default"} 
                name={"name"} 
                placeholder="Trick Name" />
                <SubmitButton title={"Submit"} foregroundColor={colors.dark} backgroundColor={colors.primary} />
            </AppForm>
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    container:{
        margin: 10
    }
})
export default AddTrickScreen;