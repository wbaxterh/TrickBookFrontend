import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import colors from '../config/colors';
import AppText from './AppText';
const radius = 50;
  const circumference = 2 * Math.PI * radius;
const RoundedLineCircle = ({ totalAmount, totalCompleted }) => {
  const totalToDo = totalAmount - totalCompleted;
  const completedPercentage = Math.floor((totalCompleted / totalAmount) * 100);
  const toDoPercentage = 100 - completedPercentage;
  const stringTotal = typeof totalCompleted === "number" ? totalCompleted.toString() : "";
  const stringAmount = typeof totalAmount === "number" ? totalAmount.toString() : "";
  
  const strokeDashoffset = circumference - (circumference * completedPercentage) / 100;
  return (
    <View style={styles.outerContainer}>
        <View style={styles.container}>
        <View style={[styles.background, { strokeDashoffset }]} />
        <View style={[styles.progress, { strokeDashoffset }]} />
        <Text style={styles.text}>{stringTotal + "/" + stringAmount}</Text>
        </View>
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
      position: 'relative'
    },
    progress: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 100,
      height: 100,
      borderRadius: 50,
      borderWidth: 10,
      borderColor: colors.primary,
      borderStyle: 'solid',
      borderTopColor: 'transparent',
      borderRightColor: 'transparent',
      transform: [{ rotate: '-90deg' }],
    },
    background: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 100,
      height: 100,
      borderRadius: 50,
      borderWidth: 10,
      borderColor: '#e1e1e1',
      borderStyle: 'solid',
      borderTopColor: 'transparent',
      borderRightColor: 'transparent',
      transform: [{ rotate: '-90deg' }],
      strokeDasharray: circumference,
      strokeDashoffset: 0,
    },
    text: {
      position: 'absolute',
      top: 50,
      left: 0,
      right: 0,
      textAlign: 'center',
      color: colors.dark,
      fontSize: 20,
      fontWeight: 'bold',
    },
  });

export default RoundedLineCircle;