import React from "react";
import {createNativeStackNavigator} from "@react-navigation/native-stack";
import ListTrickListsScreen from "../screens/ListTrickListsScreen";
import StatsScreen from "../screens/StatsScreen";
import AccountScreen from "../screens/AccountScreen";
import TrickNavigator from "./TrickNavigator";
import EditAccountDetailsScreen from "../screens/EditAccountDetailsScreen";
import SettingsScreen from "../screens/SettingsScreen";
import GuestTrickListScreen from "../screens/GuestTrickListScreen";
const Stack = createNativeStackNavigator();

const GuestNavigator = () =>{
    return(
    <Stack.Navigator >
        <Stack.Screen name="My Account" component={AccountScreen}/>
        <Stack.Screen name="Edit Account" component={EditAccountDetailsScreen}/>
        <Stack.Screen name="Guest Tricks" component={GuestTrickListScreen}/>
        <Stack.Screen name="Settings" component={SettingsScreen}/>
        <Stack.Screen name="Stats" component={StatsScreen}/>
    </Stack.Navigator>
    );
}
export default GuestNavigator;