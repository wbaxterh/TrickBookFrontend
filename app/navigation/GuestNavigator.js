import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import AccountScreen from "../screens/AccountScreen";
import ListTrickListsScreen from "../screens/ListTrickListsScreen";
import AddTrickScreen from "../screens/AddTrickScreen";
import GuestTrickNavigator from "./GuestTrickNavigator";
import GuestAccountNavigator from "./GuestAccountNavigator";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import NewListButton from "./NewListButton";

const Tab = createBottomTabNavigator();

const AppNavigator = () => {
	return (
		<Tab.Navigator
			screenOptions={{
				tabBarStyle: {
					paddingBottom: Platform.OS === "android" ? 0 : 0, // Slight padding for the overall tab bar
					height: Platform.OS === "android" ? 60 : 80,
				},
				tabBarLabelStyle: {
					marginBottom: Platform.OS === "android" ? 10 : 25, // Add margin below the label on Android
				},
				tabBarIconStyle: {
					marginBottom: Platform.OS === "android" ? 0 : 0, // Add margin below the icon on Android
				},
			}}
		>
			<Tab.Screen
				name='Account'
				component={GuestAccountNavigator}
				options={{
					headerShown: false,
					tabBarIcon: ({ color, size }) => (
						<MaterialCommunityIcons name='home' color={color} size={size} />
					),
				}}
			/>
			<Tab.Screen
				name='Add a Trick'
				component={AddTrickScreen}
				options={({ navigation }) => ({
					tabBarButton: () => (
						<NewListButton onPress={() => navigation.navigate("Add a Trick")} />
					),
				})}
			/>
			<Tab.Screen
				name='TrickList'
				component={GuestTrickNavigator}
				options={{
					headerShown: false,
					tabBarIcon: ({ color, size }) => (
						<MaterialCommunityIcons
							name='format-list-bulleted'
							color={color}
							size={size}
						/>
					),
				}}
			/>
		</Tab.Navigator>
	);
};

export default AppNavigator;
