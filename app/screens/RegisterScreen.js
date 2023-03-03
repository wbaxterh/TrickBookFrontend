import { Form } from 'formik';
import React, { useState, useContext } from 'react';
import { View, StyleSheet } from 'react-native';
import * as Yup from 'yup';
import jwtDecode from 'jwt-decode';

import userApi from '../api/users'
import authApi from '../api/auth'
import AppButton from '../components/AppButton';
import AppTextInput from '../components/AppTextInput';
import { AppForm, AppFormField, ErrorMessage, SubmitButton } from '../components/forms';
import Screen from '../components/Screen';
import colors from '../config/colors';
import AuthContext from '../auth/context';
import authStorage from '../auth/storage';

const validationSchema = Yup.object().shape({
    name: Yup.string().required().min(4).label("Name"),
    email: Yup.string().required().email().label("Email"),
    password: Yup.string().required().min(4).label("Password")
})
function RegisterScreen(props) {
    const authContext = useContext(AuthContext);
    const [registerFailed, setRegisterFailed] = useState(false);
    const handleSubmit = async ({name, email, password}) => {
        //console.log(name, email, password);
        const result = await userApi.addUser(name, email, password);
        if(result.status == 400){
            //error message
            setRegisterFailed(true);
            console.log("Error");
        }
        if(result.status == 201){
            console.log("success!!");
            //now login the user
            const result = await authApi.login(email, password);
            if(!result.ok) return setRegisterFailed(true);
            setRegisterFailed(false);
            const user =  jwtDecode(result.data)
            authContext.setUser(user);
            authStorage.storeToken(result.data)

        }
    }
    return (
        <Screen style={styles.container}>
            <AppForm
            onSubmit={handleSubmit}
            validationSchema={validationSchema}
            initialValues={{name: '', email: '', password: ''}} >
                
                <AppFormField icon="account" 
                    name={"name"} 
                    placeholder="Full Name"
                    autoCapitalize={"none"} 
                    autoCorrect={false}  />
                <AppFormField icon="email" 
                    name={"email"} 
                    keyboardType="email-address" 
                    placeholder="Email Address"
                    autoCapitalize={"none"} 
                    autoCorrect={false} 
                    textContentType={"emailAddress"} />
                <AppFormField icon="lock" name={"password"}
                    autoCapitalize={"none"}
                    autoCorrect={false} 
                    placeholder={"Password"} 
                    textContentType={"password"}
                    secureTextEntry />
                <SubmitButton title="Submit" foregroundColor={colors.dark} backgroundColor={colors.primary} />
                <ErrorMessage error="That Email Address already exists" visible={registerFailed}/>
            </AppForm>
        </Screen>
    );
}
const styles = StyleSheet.create({
    container:{
        margin: 10
    }
})
export default RegisterScreen;