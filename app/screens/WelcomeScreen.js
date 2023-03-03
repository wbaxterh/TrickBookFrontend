import React from 'react';
import { Image, ImageBackground, StyleSheet, Text, View } from 'react-native';
import AppButton from '../components/AppButton';

import colors from '../config/colors';
import routes from '../navigation/routes';
function WelcomeScreen({navigation}) {
    return (
        <ImageBackground
        blurRadius={10}
         style={styles.background}
        source={require('../assets/background.png')}>
            <View style={styles.logoContainer}>
                <Image style={styles.logo} source={require('../assets/TrickBookLogo.png')}/>
                <Text style={styles.tagline}>Your ever changing trickbook</Text>
            </View>
            
            <View style={styles.buttonsContainer}>
                <AppButton title="Log In" onPress={() => navigation.navigate(routes.LOGIN)} foregroundColor={colors.dark}  />
                <AppButton title="Register" onPress={() => navigation.navigate(routes.REGISTER)} foregroundColor={colors.dark} backgroundColor={colors.light} />
            </View>
        </ImageBackground>
    );
}
const styles = StyleSheet.create({
    background:{
        flex: 1,
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    logo:{
        width: 100,
        height: 100,
        
    },
    logoContainer:{
        position: 'absolute',
        top: 50,
        alignItems: 'center'
    },
    tagline:{
        background: colors.secondary,
        color: "#fff",
        position: 'relative',
        top: 20,
        fontSize: 20,
        fontWeight: 'bold',
        textShadowColor: colors.black,
        padding: 10
    },
    buttonsContainer: {
        padding: 20,
        width: '100%'
    }
})

export default WelcomeScreen;