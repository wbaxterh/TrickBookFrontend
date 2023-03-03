import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppForm, AppFormField, SubmitButton } from '../components/forms';
import * as Yup from 'yup';
import Screen from '../components/Screen';
import tricksApi from '../api/tricks';
import colors from '../config/colors';

const validationSchema = Yup.object().shape({
    name: Yup.string().required().label("name")
});
function EditTrickListScreen({route, navigation}) {
    let trickListId = route.params._id;
    let initialName = route.params.name;

    const handleSubmit = async(trickList) =>{
        let setTrickList = {...trickList, trickListId}
        const result = await tricksApi.editTrickList(setTrickList);
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
            initialValues={{name: initialName}}
            validationSchema={validationSchema} 
            onSubmit={handleSubmit}>
                <AppFormField name={"name"} placeholder={"Name"} />
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

export default EditTrickListScreen;