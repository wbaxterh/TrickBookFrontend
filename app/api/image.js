import apiClient from './client';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';


const FormData = require('form-data');

const endpoint = "/image"
const getImage = (uri) => {
    return apiClient.get(endpoint, uri);
}
const setImage = async (givendata) =>{
    try{
    
    //console.log("filename", filepath)
    const filepath = givendata.image;
    const manipResult = await manipulateAsync(
        filepath,
        [{resize: { width: 640 }}],
        { compress: 0.2, format: SaveFormat.JPEG }
      );
      
    //   //console.log(manipResult.uri)
    // const file = await FileSystem.readAsStringAsync(manipResult.uri, { encoding: FileSystem.EncodingType.Base64 });
    const data = new FormData();
    // Append the file to the FormData object

    // Append the file to the FormData object
    data.append("email", givendata.email);
    data.append('file', {
        uri: manipResult.uri,
        type: 'image/jpeg',
        name: 'profile-pic.jpg'
    });
    // Send the FormData object to the server
    return apiClient.post(endpoint, data);
  } catch (err) {
    console.log(err);
  }
}

export default {
    getImage,
    setImage
}