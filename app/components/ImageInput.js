import React, {useEffect} from 'react';
import {View, StyleSheet, Image, TouchableWithoutFeedback, Alert} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import colors from '../config/colors';
import * as ImagePicker from 'expo-image-picker';

function ImageInput({imageUri, onChangeImage}) {
   
    const requestPermission = async () => {
        const {granted} = await ImagePicker.requestCameraPermissionsAsync();
        if(!granted) alert("You need camera permissions enabled to access photos");
    }
    useEffect(() =>{
        requestPermission();
      }, []);
    const handlePress = () =>{
        if(!imageUri) selectImage();
        else Alert.alert('Delete', 'Are you sure you want to delete?', [
        {text: 'Yes', onPress: () => onChangeImage(null)},
        {text: 'No'}
        ]);
    }
    const selectImage = async () => {
        try {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.5
          });
          if(!result.canceled){
            onChangeImage(result.assets[0].uri);
            // console.log(result.assets[0].uri);
          }
        } catch (error) {
          console.log("error reading an image", error);
        }
        
      }
    return (
    <TouchableWithoutFeedback onPress={handlePress}>
      <View style={styles.container}>
        {!imageUri && (
        <MaterialCommunityIcons name="camera" size={40} color={colors.medium} />
        )}
        {imageUri && <Image source={{ uri: imageUri}} style={styles.image} />}
      </View>
    </TouchableWithoutFeedback>
    );
}
const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.light,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        height: 100,
        width: 100
    },
    image: {
        width: "100%",
        height: "100%",
        borderRadius: 15,
    }
})
export default ImageInput;