import React from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants'
import colors from '../config/colors';

function Screen({children, style}) {
    return (
        <SafeAreaView style={[styles.screen, style]} >
            {children}
        </SafeAreaView>
    );
}
const styles = StyleSheet.create({
    screen:{
        paddingTop: Constants.statusBarHeight,
        flex: 1,
        background: colors.white,
    }
})
export default Screen;