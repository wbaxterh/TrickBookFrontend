import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ListTrickListsScreen from "../screens/ListTrickListsScreen";
import StatsScreen from "../screens/StatsScreen";
import AccountScreen from "../screens/AccountScreen";
import TrickNavigator from "./TrickNavigator";
import EditAccountDetailsScreen from "../screens/EditAccountDetailsScreen";
import SettingsScreen from "../screens/SettingsScreen";
import TutorialScreen from "../screens/TutorialScreen";
import HowToUse from "../screens/HowToUse";
import SpinTheWheelScreen from "../screens/SpinTheWheelScreen";
const Stack = createNativeStackNavigator();

const AccountNavigator = () => {
	return (
		<Stack.Navigator>
			<Stack.Screen name='My Account' component={AccountScreen} />
			<Stack.Screen name='Edit Account' component={EditAccountDetailsScreen} />
			<Stack.Screen name='Trick Lists' component={TrickNavigator} />
			<Stack.Screen name='Settings' component={SettingsScreen} />
			<Stack.Screen name='Stats' component={StatsScreen} />
			<Stack.Screen name='Spin The Wheel' component={SpinTheWheelScreen} />
			<Stack.Screen name='Tutorials' component={TutorialScreen} />
			<Stack.Screen name='How To Use' component={HowToUse} />
		</Stack.Navigator>
	);
};
export default AccountNavigator;
