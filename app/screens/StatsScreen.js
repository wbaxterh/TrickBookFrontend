import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet } from 'react-native';
import AuthContext from '../auth/context';
import AppText from '../components/AppText';
import Screen from '../components/Screen';
import tricks from '../api/tricks';
import RoundedLineBar from '../components/RoundedLineBar';
import colors from '../config/colors';
import RoundedLineCircle from '../components/RoundedLineCircle';

function StatsScreen({navigation}) {
    const authContext = useContext(AuthContext);
    const [totalTricks, setTotalTricks] = useState();
    const [totalTrickLists, setTotalTrickLists] = useState();
    const [toDoTricks, setToDoTricks] = useState();
    const [completeTricks, setCompleteTricks] = useState();

    const loadTrickStatus = async() => {
        let trickList = await tricks.getTricks(authContext.user.userId);
        let totalToDo = 0;
        let totalCompleted = 0;
        let totalTricks = 0;
        let totalTrickLists = 0;


        trickList.data.forEach(item => {
            totalTrickLists = totalTrickLists + 1;
            totalTricks += item.tricks.length;
            item.tricks.forEach(trick => {
            if (trick.checked === 'To Do') {
            totalToDo++;
            } else if (trick.checked === 'Complete') {
            totalCompleted++;
            }
            });
        });

        setToDoTricks(totalToDo);
        setCompleteTricks(totalCompleted);
        setTotalTricks(totalTricks);
        setTotalTrickLists(totalTrickLists);

    }
    useEffect(() => {
        loadTrickStatus();
        const reload = navigation.addListener('focus', () => {
            // The screen is focused
            // Call the refresh function
            loadTrickStatus();
          });
          // Return the unsubscribe function to clean up the listener
          return reload;
    }, [navigation]);
   
    return (
        <Screen>
            <View style={styles.container}>
                <View style={styles.numberContainer}>
                    <AppText style={styles.number}>{totalTrickLists}</AppText>
                    <AppText style={styles.subTitle}>Total Trick Lists</AppText>
                </View>
                <View style={styles.numberContainer}>
                    <AppText style={styles.number}>{totalTricks}</AppText>
                    <AppText style={styles.subTitle}>Total Tricks</AppText>
                </View>
            </View>
            <View style={styles.container}>
                
                <View style={styles.numberContainer}>
                    <AppText style={styles.number}>{completeTricks}</AppText>
                    <AppText style={styles.subTitle}>Tricks Completed</AppText>
                </View>
                <View style={styles.numberContainer}>
                    <AppText style={styles.number}>{toDoTricks}</AppText>
                    <AppText style={styles.subTitle}>Tricks To Do</AppText>
                    
                </View>
               
            </View>
            <View style={styles.container}>
            <RoundedLineBar totalAmount={totalTricks} totalCompleted={completeTricks} />
            </View>
          
        </Screen>
    );
}
const styles = StyleSheet.create({
    container: {
        padding: 5,
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      },
      numberContainer: {
        flex: 1,
        width: '50%',
        alignItems: 'center',
      },
      number: {
        fontSize: 32,
        fontWeight: 'bold',
      },
      subTitle: {
        fontSize: 18,
        marginTop: 8,
      }
})
export default StatsScreen;