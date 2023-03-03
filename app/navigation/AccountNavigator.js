import React from "react";
import {createNativeStackNavigator} from "@react-navigation/native-stack";
import ListTrickListsScreen from "../screens/ListTrickListsScreen";
import StatsScreen from "../screens/StatsScreen";
import AccountScreen from "../screens/AccountScreen";
import TrickNavigator from "./TrickNavigator";
import EditAccountDetailsScreen from "../screens/EditAccountDetailsScreen";
const Stack = createNativeStackNavigator();

const AccountNavigator = () =>{
    return(
    <Stack.Navigator >
        <Stack.Screen name="My Account" component={AccountScreen}/>
        <Stack.Screen name="Edit Account" component={EditAccountDetailsScreen}/>
        <Stack.Screen name="Trick Lists" component={TrickNavigator}/>
        <Stack.Screen name="Stats" component={StatsScreen}/>
    </Stack.Navigator>
    );
}
export default AccountNavigator;