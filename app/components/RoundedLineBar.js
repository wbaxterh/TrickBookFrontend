import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import colors from '../config/colors';
import AppText from './AppText';



const RoundedLineBar = ({ totalAmount, totalCompleted }) => {
  const totalToDo = totalAmount - totalCompleted;
  const completedPercentage = Math.floor((totalCompleted / totalAmount) * 100);
  const toDoPercentage = 100 - completedPercentage;
  const stringTotal = typeof totalCompleted === "number" ? totalCompleted.toString() : "";
  const stringAmount = typeof totalAmount === "number" ? totalAmount.toString() : "";
  return (
    <View style={styles.outerContainer}>
        <View style={styles.container}>
        <View style={[styles.progress, { width: `${completedPercentage}%` }]} />
        </View>
        <AppText style={{color: colors.dark}}>{stringTotal + "/" + stringAmount}</AppText>
        <AppText style={{color: colors.dark}}>Total Tricks Completed</AppText>
    </View>
  );
};
const styles = StyleSheet.create({
    outerContainer:{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    container: {
      width: '100%',
      height: 10,
      borderRadius: 5,
      backgroundColor: '#e1e1e1',
      overflow: 'hidden',
      marginBottom: 10
    },
    progress: {
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary
    }
  });

export default RoundedLineBar;