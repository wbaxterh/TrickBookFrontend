import React, { useRef } from 'react';
import { View, StyleSheet, TextInput, Platform, Touchable, TouchableWithoutFeedback } from 'react-native';
import {MaterialCommunityIcons} from "@expo/vector-icons"
import defaultStyles from '../config/styles';
import colors from '../config/colors';

function AppTextInput({icon, ...otherProps}) {
    const inputRef = useRef(null);
    const handlePress = () => {
      inputRef.current.focus();
    };
    return (
        <TouchableWithoutFeedback onPress={handlePress}>
        <View style={styles.container}>
            {icon && <MaterialCommunityIcons style={styles.icon} name={icon} size={20} color={defaultStyles.colors.dark}/> }
            <TextInput ref={inputRef} style={[defaultStyles.text, styles.input]} {...otherProps} placeholderTextColor="#666666" />
        </View>
        </TouchableWithoutFeedback>
    );
}
const styles = StyleSheet.create({
    container:{
        backgroundColor: defaultStyles.colors.light,
        borderRadius: 25,
        flexDirection: 'row',
        width: '100%',
        padding: 15,
        marginVertical: 10
    },
    icon:{
        marginRight: 5,
        alignSelf: 'center'
    },
})
export default AppTextInput;