import React from 'react';
import { Text, View } from 'react-native';
import defaultStyles from '../config/styles';
import AppText from './AppText';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import colors from '../config/colors';

function AppInfoText({style, children}) {
    return (
        <View style={defaultStyles.infoTextContainer}>
            <MaterialCommunityIcons name="information" size={20} color={colors.dark} style={{paddingRight: 5}} />
            <AppText style={[{fontWeight: '600'}, style]}>
                {children}
            </AppText>
        </View>
    );
}

export default AppInfoText;