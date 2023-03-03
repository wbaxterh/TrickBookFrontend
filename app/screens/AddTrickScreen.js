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

const validationSchema = Yup.object().shape({
    name: Yup.string().required().label("Name"),
})
function AddTrickScreen({route, navigation}) {
    let trickListId = route.params._id;
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
    return (
        <Screen style={styles.container}>
            <View style={styles.container}>
            <AppForm initialValues={{name: ''}} style={styles.container} onSubmit={handleSubmit}
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