import React from "react";
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import AccountScreen from "../screens/AccountScreen";
import ListTrickListsScreen from "../screens/ListTrickListsScreen";
import CreateTrickListScreen from "../screens/CreateTrickListScreen";
import TrickNavigator from "./TrickNavigator";
import AccountNavigator from "./AccountNavigator";
import {MaterialCommunityIcons} from '@expo/vector-icons';
import NewListButton from "./NewListButton";

const Tab = createBottomTabNavigator();

const AppNavigator = () =>{
    return(
    <Tab.Navigator>
        <Tab.Screen name="Account" component={AccountNavigator}  options={{headerShown: false, 
        tabBarIcon: ({color, size}) => <MaterialCommunityIcons name="home" color={color} size={size}/>
        }}/>
        <Tab.Screen name="Add a List" component={CreateTrickListScreen} options={({navigation}) => (
          {  tabBarButton: () => <NewListButton onPress={() => navigation.navigate("Add a List")}/> }
        )}/>
        <Tab.Screen name="TrickLists" component={TrickNavigator} options={{headerShown: false,
        tabBarIcon: ({color, size}) => <MaterialCommunityIcons name="format-list-bulleted" color={color} size={size}/>}}/>
        
    </Tab.Navigator>
    );
}

export default AppNavigator;