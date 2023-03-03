import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import colors from '../config/colors';
import {MaterialCommunityIcons} from '@expo/vector-icons'
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { TouchableWithoutFeedback } from 'react-native-gesture-handler';

function TrickEdit({onPress}) {
    return (
            <TouchableOpacity style={styles.container} onPress={onPress}>
                    <MaterialCommunityIcons 
                    name="book-edit"
                    size={35}
                    color={colors.white}/>
            </TouchableOpacity> 
    );
}
const styles = StyleSheet.create({
    container:{
        flex: 0.2,
        backgroundColor: colors.blue,
        width: 70,
        justifyContent: 'center',
        alignItems: 'center'
    }
})

export default TrickEdit;