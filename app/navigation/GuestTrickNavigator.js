import React from "react";
import {createNativeStackNavigator} from "@react-navigation/native-stack";
import GuestTrickListScreen from "../screens/GuestTrickListScreen";
import AddTrickScreen from "../screens/AddTrickScreen";
import { Modal } from "react-native";
import AppButton from "../components/AppButton";
import colors from "../config/colors";
import TrickDetailsScreen from "../screens/TrickDetailsScreen";

const Stack = createNativeStackNavigator();

const GuestTrickNavigator = () =>{
    return(
    <Stack.Navigator mode="modal" screenOptions={{headerShown: true}}>
        <Stack.Screen name="Guest Tricks" component={GuestTrickListScreen} />
        <Stack.Group screenOptions={{ presentation: 'modal'}}>
            <Stack.Screen name="Add Trick" component={AddTrickScreen} options={({ navigation }) => ({ headerRight: () => (
                <AppButton
                    onPress={() => navigation.goBack()}
                    title="Close"
                    foregroundColor={colors.dark}
                    backgroundColor={colors.white}
                    style={{padding: 0}}
                />
                )})} />
                
        </Stack.Group>
    </Stack.Navigator>
    );
}
export default GuestTrickNavigator;