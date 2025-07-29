import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Platform } from "react-native"; // Import Platform module
import CreateTrickListScreen from "../screens/CreateTrickListScreen";
import TrickNavigator from "./TrickNavigator";
import AccountNavigator from "./AccountNavigator";
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
				component={AccountNavigator}
				options={{
					headerShown: false,
					tabBarIcon: ({ color, size }) => (
						<MaterialCommunityIcons name='home' color={color} size={size} />
					),
				}}
			/>
			<Tab.Screen
				name='Add a List'
				component={CreateTrickListScreen}
				options={({ navigation }) => ({
					tabBarButton: () => (
						<NewListButton onPress={() => navigation.navigate("Add a List")} />
					),
				})}
			/>
			<Tab.Screen
				name='TrickLists'
				component={TrickNavigator}
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
