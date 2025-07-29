import React, { useRef, useState } from 'react';
import { View, StyleSheet, TextInput, Platform, Touchable, TouchableWithoutFeedback, TouchableOpacity } from 'react-native';
import {MaterialCommunityIcons} from "@expo/vector-icons"
import defaultStyles from '../config/styles';
import colors from '../config/colors';

function AppTextInput({icon, secureTextEntry, showPasswordToggle, ...otherProps}) {
    const inputRef = useRef(null);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    
    const handlePress = () => {
      inputRef.current.focus();
    };
    
    const togglePasswordVisibility = () => {
      setIsPasswordVisible(!isPasswordVisible);
    };
    
    return (
        <TouchableWithoutFeedback onPress={handlePress}>
        <View style={styles.container}>
            {icon && <MaterialCommunityIcons style={styles.icon} name={icon} size={20} color={defaultStyles.colors.dark}/> }
            <TextInput 
                ref={inputRef} 
                style={[defaultStyles.text, styles.input]} 
                {...otherProps} 
                secureTextEntry={secureTextEntry && !isPasswordVisible}
                placeholderTextColor="#666666" 
            />
            {showPasswordToggle && secureTextEntry && (
                <TouchableOpacity onPress={togglePasswordVisibility} style={styles.eyeIcon}>
                    <MaterialCommunityIcons 
                        name={isPasswordVisible ? "eye-off" : "eye"} 
                        size={20} 
                        color={defaultStyles.colors.dark}
                    />
                </TouchableOpacity>
            )}
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
    input: {
        flex: 1,
    },
    eyeIcon: {
        alignSelf: 'center',
        marginLeft: 10,
    },
})
export default AppTextInput;