import React from 'react';
import { StyleSheet, Linking, TouchableOpacity } from 'react-native';
import AppButton from '../components/AppButton';
import AppLink from '../components/AppLink';
import AppText from '../components/AppText';
import Screen from '../components/Screen';
import colors from '../config/colors';
import routes from '../navigation/routes';

function TrickDetailsScreen({route, navigation}) {
    const handlePress = () =>{
        navigation.pop()
        navigation.navigate(routes.EDITTRICK, route.params)
    }
    return (
        <Screen style={styles.container}>
            <AppText style={styles.name}>Trick: {route.params.name}</AppText>
            <AppText><AppLink url={route.params.link} /></AppText>
            <AppText>{route.params.notes}</AppText>
            <AppButton title="Edit Trick" backgroundColor={colors.primary} foregroundColor={colors.dark} onPress={handlePress} />
        </Screen>
    );
}
const styles = StyleSheet.create({
    container:{
        margin: 10
    },
    name:{
        fontSize: 20,
        fontWeight: "800",
        marginBottom: 10
    }
})
export default TrickDetailsScreen;