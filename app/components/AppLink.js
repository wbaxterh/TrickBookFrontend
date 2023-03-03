import React from 'react';
import {Linking, TouchableOpacity, StyleSheet } from 'react-native';
import AppText from './AppText';
import defaultStyles from '../config/styles';
import styles from '../config/styles';
import colors from '../config/colors';

function AppLink({url}) {
    return (
    <TouchableOpacity style={stylesheet.container} onPress={() => Linking.openURL(url)}>
      <AppText style={defaultStyles.link}>{url}</AppText>
    </TouchableOpacity>
    );
}
const stylesheet = StyleSheet.create({
    container:{
  
    }
})

export default AppLink;