import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import colors from '../config/colors';

function AppButton({style, width = "100%", title, onPress, foregroundColor=colors.white, backgroundColor = colors.primary}) {
    return (
        <TouchableOpacity style={[styles.button, {backgroundColor: backgroundColor}, style]} onPress={onPress}>
                <Text style={[styles.text, {color: foregroundColor}]}>{title}</Text>
        </TouchableOpacity>
    );
}
const styles = StyleSheet.create({
    button:{
        backgroundColor: colors.primary,
        borderRadius: 25,
        padding: 15,
        marginVertical: 10
    },
    text:{
        color: colors.black,
        fontSize: 18,
        textTransform: 'uppercase',
        fontWeight: 'bold',
        alignSelf: 'center'

    }
})
export default AppButton;