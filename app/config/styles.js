import {Platform} from "react-native";

import colors from "./colors"
export default {
    colors,
    text:{
        fontSize: 18,
        fontFamily: Platform.OS === "android" ? "Roboto" : "Avenir",
        color: colors.dark
    
    },
    link:{
        textDecorationLine: 'underline',
        color: colors.blue,
        fontWeight: '600',
    },
    infoTextContainer:{
        backgroundColor: colors.light,
        marginTop: 10,
        padding: 5,
        borderWidth: 0,
        borderRadius: 5,
        flexDirection: 'row',
        alignItems: 'center'
    }
}

