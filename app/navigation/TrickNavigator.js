import React from "react";
import {createNativeStackNavigator} from "@react-navigation/native-stack";
import ListTrickListsScreen from "../screens/ListTrickListsScreen";
import TrickListScreen from "../screens/TrickListScreen";
import EditTrickScreen from "../screens/EditTrickScreen";
import EditTrickListScreen from "../screens/EditTrickListScreen";
import AddTrickScreen from "../screens/AddTrickScreen";
import { Modal } from "react-native";
import AppButton from "../components/AppButton";
import colors from "../config/colors";
import TrickDetailsScreen from "../screens/TrickDetailsScreen";

const Stack = createNativeStackNavigator();

const TrickNavigator = () =>{
    return(
    <Stack.Navigator mode="modal" screenOptions={{headerShown: true}}>
        <Stack.Screen name="My Trick Lists" component={ListTrickListsScreen}/>
        <Stack.Group screenOptions={{ presentation: 'modal'}}>
        <Stack.Screen name="Edit Trick List" component={EditTrickListScreen} options={({ navigation }) => ({ headerRight: () => (
                <AppButton
                    onPress={() => navigation.goBack()}
                    title="Close"
                    foregroundColor={colors.dark}
                    backgroundColor={colors.white}
                    style={{padding: 0}}
                />
                )})} />
        </Stack.Group>
        <Stack.Screen name="Tricks" component={TrickListScreen} options={({route}) => ({title: route.params.name})}/>
        <Stack.Group screenOptions={{ presentation: 'modal'}}>
            <Stack.Screen name="Edit Trick" component={EditTrickScreen} options={({ navigation }) => ({ headerRight: () => (
                <AppButton
                    onPress={() => navigation.goBack()}
                    title="Close"
                    foregroundColor={colors.dark}
                    backgroundColor={colors.white}
                    style={{padding: 0}}
                />
                )})} />
            <Stack.Screen name="Add Trick" component={AddTrickScreen} options={({ navigation }) => ({ headerRight: () => (
                <AppButton
                    onPress={() => navigation.goBack()}
                    title="Close"
                    foregroundColor={colors.dark}
                    backgroundColor={colors.white}
                    style={{padding: 0}}
                />
                )})} />
                <Stack.Screen name="Trick Details" component={TrickDetailsScreen} options={({ navigation }) => ({ headerRight: () => (
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
export default TrickNavigator;