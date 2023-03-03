import React from 'react';
import { View, StyleSheet, Text, Image, TouchableNativeFeedback } from 'react-native';
import { TouchableHighlight, TouchableWithoutFeedback } from 'react-native-gesture-handler';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Swipeable from 'react-native-gesture-handler/Swipeable';
import colors from '../config/colors';

function ListItem({title, image, IconComponent, subTitle, onPress, renderRightActions, renderLeftActions}) {

    return (
        <GestureHandlerRootView>
        <Swipeable renderRightActions={renderRightActions} renderLeftActions={renderLeftActions}>
            <TouchableNativeFeedback onPress={onPress} underlayColor={colors.light} >
                <View style={styles.container}>
                    {IconComponent}
                    {image && <Image style={styles.image} source={image} />}
                    <View style={styles.detailsContainer}>
                        <Text style={styles.title}>{title}</Text> 
                        {subTitle && <Text style={styles.subtitle}>{subTitle}</Text>}
                    </View>
                </View>
            </TouchableNativeFeedback>
        </Swipeable>
        </GestureHandlerRootView>
    );
}
const styles = StyleSheet.create({
    container:{
       flexDirection: 'row',
        flexWrap: 'wrap',
        width: '100%',
        alignItems: 'center',
        padding: 15,
        backgroundColor: colors.white
    },
    detailsContainer:{
        marginLeft: 10,
        justifyContent: 'center'
    },
    title:{
        fontSize: 18,
        color: colors.black,
        fontWeight: "500"
    },
    subtitle: {
        fontSize: 12,
        color: colors.black
    },
    image:{
        width: 70,
        height: 70,
        borderRadius: 35,
        marginRight: 10
    }

})
export default ListItem;