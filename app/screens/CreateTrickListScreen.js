import React, {useContext, useState, useEffect} from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Yup from 'yup';
import { AppForm, SubmitButton, AppFormField  } from '../components/forms';
import AuthContext from '../auth/context';
import Screen from '../components/Screen';
import colors from '../config/colors';
import tricksApi from '../api/tricks';
import routes from '../navigation/routes';


const validationSchema = Yup.object().shape({
    title: Yup.string().required().label("Title"),
})
function CreateTrickListScreen() {
    const authContext = useContext(AuthContext);
    const navigation = useNavigation();
    const [key, setKey] = useState(0);
    
    // Reset form when screen comes into focus
    useFocusEffect(
        React.useCallback(() => {
            setKey(prev => prev + 1);
        }, [])
    );
    
    const handleSubmit = async(trick) =>{
        trick = {...trick, userId: authContext.user.userId}
        const result = await tricksApi.addTrickList(trick);
        if(!result.ok){
            alert('could not save trick list');
        }
        else{
            navigation.navigate(routes.TRICKLISTS)
        }
    }
    return (
        <Screen>
            <View style={styles.container}>
            <AppForm 
                key={key}
                initialValues={{title: ''}} 
                style={styles.container} 
                onSubmit={handleSubmit}
                validationSchema={validationSchema}>
                <AppFormField 
                autoCapitalize={"none"} 
                autoCorrect={false} 
                keyboardType={"default"} 
                name={"title"} 
                placeholder="Trick List Name" />
                <SubmitButton title={"Submit"} foregroundColor={colors.dark} backgroundColor={colors.primary} />
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
export default CreateTrickListScreen;