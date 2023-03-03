import React, {useEffect, useState, useContext} from 'react';
import {StyleSheet, FlatList, Alert} from 'react-native';
import ListItem from '../components/ListItem';
import Screen from '../components/Screen';
import AuthContext from '../auth/context';
import ListItemSeperator from '../components/ListItemSeperator';
import tricksApi from '../api/tricks';
import routes from '../navigation/routes';
import ListDelete from '../components/ListDelete';
import colors from '../config/colors';
import AppText from '../components/AppText';
import AppInfoText from '../components/AppInfoText';
import TrickEdit from '../components/TrickEdit';
import {MaterialCommunityIcons} from '@expo/vector-icons';

function ListTrickListsScreen({navigation}) {
    const [lists, setLists]= useState();
    const authContext = useContext(AuthContext);
    useEffect(() => {
        loadTricks();
        const reload = navigation.addListener('focus', () => {
            // The screen is focused
            // Call the refresh function
            loadTricks();
          });
          // Return the unsubscribe function to clean up the listener
          return reload;
    }, [navigation]);
    const loadTricks = async () => {
        const response = await tricksApi.getTricks(authContext.user.userId);
        setLists(response.data);
        //console.log(response.data);
    }
    const [refreshing, setRefreshing] = useState(false);
    const handleDelete = list => {
        Alert.alert("Delete List", "Delete " + list.name + "?", [
            {
                text: "Cancel",
                onPress: () => console.log("Cancel Pressed"),
                style: "cancel"
              },
              { text: "OK", onPress: () => {
                //Delete tricklist from state array
                setLists(lists.filter((t) => t._id !== list._id)) 
                //Call server delete tricklist and related tricks from DB
                const deleted = tricksApi.deleteTrickList(list._id)
                //do something with the result?
            }
            }
        ])
        
        
       }
    const handleEdit = list => {
        console.log("edit pressed: ", list);
    }
    return (
        <Screen style={styles.container}>
            {lists == null || lists == "" ? <AppInfoText>Click the + Button to add a Trick List!</AppInfoText> : 
            <FlatList 
                data={lists} 
                keyExtractor={list => list._id.toString()}
                renderItem={({item}) => 
                    <ListItem
                        IconComponent={(<MaterialCommunityIcons name="format-list-bulleted" size={20} color={colors.medium}/>)} 
                        title={item.name} 
                        subTitle={"Tricks: " + `${ (item.tricks.length - item.tricks.filter(trick => trick.checked === 'To Do').length) }` + "/" + item.tricks.length.toString()} 
                        //subTitle={`Tricks: ${item.tricks.length}, To Do: ${item.tricks.filter(trick => trick.checked === 'To Do').length}`}
                        onPress={() => navigation.navigate(routes.TRICKS, item)} 
                        renderRightActions={() => (<ListDelete onPress={() => handleDelete(item)} />)}
                        renderLeftActions={() => (<TrickEdit onPress={() => navigation.navigate(routes.EDITTRICKLIST, item)}/>)} 
                    />}
                ItemSeparatorComponent={() => <ListItemSeperator />}
                refreshing={refreshing}
                onRefresh={loadTricks}
                style={styles.container}
                />
            }
        </Screen>
    );
}
const styles = StyleSheet.create({
    container:{
        backgroundColor: colors.light
    }
})
export default ListTrickListsScreen;
