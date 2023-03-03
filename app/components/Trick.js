import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableHighlight, TouchableNativeFeedback } from 'react-native';
import colors from '../config/colors';
import AppButton from './AppButton';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Swipeable from 'react-native-gesture-handler/Swipeable';

import trickApi from '../api/trick';


function Trick({trick, name, checked, onPress, renderRightActions, renderLeftActions}) {
    let initColorState = colors.secondary;
    let initTextColorState = colors.white;
    const [checkedState, setCheckedState] = useState(checked);
    if(checkedState == "Complete"){
        initColorState = colors.primary;
        initTextColorState = colors.black;
    }
    const [colorState, setColorState] = useState(initColorState);
    const [textColorState, setTextColorState] = useState(initTextColorState);
    function onCheck(){
        if(checkedState == "To Do"){
            setColorState(colors.primary);
            setCheckedState("Complete");
            setTextColorState(colors.black);
            //call api to edit trick to "Complete"
            let newTrick = {...trick, checked: "Complete"}
            //console.log(newTrick);
            trickApi.updateTrick(newTrick);
            
        }
        if(checkedState == "Complete"){
            setColorState(colors.secondary);
            setCheckedState("To Do");
            setTextColorState(colors.white);
            //call api to edit trick to "To Do" 
            let newTrick = {...trick, checked: "To Do"}
            trickApi.updateTrick(newTrick);
            //console.log(newTrick);
        }
    }
    return (
        <GestureHandlerRootView>
        <Swipeable renderRightActions={renderRightActions} renderLeftActions={renderLeftActions}>
            <TouchableNativeFeedback underlayColor={colors.light} onPress={onPress}>
                <View style={styles.container}>
                    <Text style={styles.text}>{name}</Text>
                    <AppButton style={styles.button} title={checkedState} onPress={onCheck} backgroundColor={colorState} foregroundColor={textColorState}/>
                </View>
            </TouchableNativeFeedback>
        </Swipeable>
        </GestureHandlerRootView>
    );
}
const styles = StyleSheet.create({
    container :{
        width: '100%',
        backgroundColor: colors.white,
        padding: 15,
        border: 1,
        justifyContent: 'space-evenly',
        flexDirection: 'row',
        flexWrap: "wrap",
        alignItems: 'center',
        flex: 1
    },
    text:{
        marginRight: 10, fontSize: 18, fontWeight: 'bold',
        flexDirection: 'column',
        flex: 1.2
    },
    button:{
        justifyContent:'center',
        alignItems: 'center',
        flexDirection: 'column',
        flex: 0.8
    }
})

export default Trick;