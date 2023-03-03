import React from 'react';
import { View, StyleSheet } from 'react-native';
import AppButton from '../components/AppButton';
import AppText from '../components/AppText';
import AppTextInput from '../components/AppTextInput';
import * as Yup from 'yup';
import { AppForm, AppFormField, SubmitButton } from '../components/forms';
import Screen from '../components/Screen';
import colors from '../config/colors';
import trickApi from '../api/trick';

const validationSchema = Yup.object().shape({
    name: Yup.string().required().label("name"),
    link: Yup.string().label("link"),
    notes: Yup.string().label("notes"),
})
function EditTrickScreen ({route, navigation}) {
    // console.log(route.params);
    let trickId = route.params._id;
    let initialName = route.params.name;
    let initialLink = route.params.link;
    if(initialLink == undefined){
        initialLink = '';
    }
    let initialNotes = route.params.notes;
    if(initialNotes == undefined){
        initialNotes = '';
    }
    const handleSubmit = async(trick) =>{
        let setTrick = {...trick, trickId}
        //console.log("submit fired");
        const result = await trickApi.editTrick(setTrick);
        if(!result.ok){
            alert('could not edit trick');
        }
        else{
            //console.log("success");
            navigation.goBack();
        }
    }
    return (
        <Screen>
            <View style={styles.container}>
            <AppForm 
            initialValues={{name: initialName, link: initialLink, notes: initialNotes}}
            validationSchema={validationSchema} 
            onSubmit={handleSubmit}>
                <AppFormField name={"name"} placeholder={"Name"} />
                <AppFormField name={"link"} placeholder={"https://your-trick-link.com/"}
                autoCapitalize={"none"} 
                autoCorrect={false} 
                keyboardType={"default"} />
                <AppFormField name={"notes"} placeholder={"Additional Notes"} 
                autoCapitalize={"none"} 
                autoCorrect={false} 
                keyboardType={"default"} 
                multiline={true}/>
                <SubmitButton title="Submit"  />
            </AppForm>
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    container:{
        backgroundColor: colors.white,
        padding: 20
    }
})
export default EditTrickScreen;