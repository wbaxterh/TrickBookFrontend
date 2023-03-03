import React, {useContext, useState} from 'react';
import { StyleSheet, Image } from 'react-native';
import * as Yup from 'yup';
import jwtDecode from 'jwt-decode';

import authApi from '../api/auth'
import Screen from '../components/Screen';
import {ErrorMessage, AppForm, AppFormField, SubmitButton} from '../components/forms';
import AuthContext from '../auth/context';
import authStorage from '../auth/storage';

const validationSchema = Yup.object().shape({
    email: Yup.string().required().email().label("Email"),
    password: Yup.string().required().min(4).label("Password")
})

function LoginScreen(props) {
    const authContext = useContext(AuthContext);
    const [loginFailed, setLoginFailed] = useState(false);
    const handleSubmit = async ({email, password}) => {
        const result = await authApi.login(email, password);
        if(!result.ok) return setLoginFailed(true);
        setLoginFailed(false);
        const user =  jwtDecode(result.data)
        authContext.setUser(user);
        authStorage.storeToken(result.data)
    }
    return (
        <Screen style={styles.container}>
            <Image style={styles.logo}source={require('../assets/TrickBookLogo.png')} />
            <AppForm 
                initialValues={{email: '', password: ''}} 
                onSubmit={handleSubmit}
                validationSchema={validationSchema}>
                    <ErrorMessage error="Invalid email and/or password" visible={loginFailed}/>
                <AppFormField 
                    name={"email"}
                    icon={"email"} 
                    placeholder={"Email Address"} 
                    autoCapitalize={"none"} 
                    autoCorrect={false} 
                    keyboardType={"email-address"} 
                    textContentType={"emailAddress"}
                    />
                    <AppFormField 
                    name={"password"}
                    autoCapitalize={"none"}
                    autoCorrect={false} 
                    placeholder={"Password"} 
                    icon={"lock"}
                    textContentType={"password"}
                    secureTextEntry
                    />
                    <SubmitButton title={"Login"} />
            </AppForm>
                    
        </Screen>
    );
}
const styles = StyleSheet.create({
    container:{
        marginHorizontal: 10
    },
    logo:{
        width: 80,
        height: 80,
        alignSelf: 'center',
        marginTop: 20,
        marginBottom: 10
    }
})
export default LoginScreen;