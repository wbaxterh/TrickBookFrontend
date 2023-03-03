import React, { useContext, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Screen from '../components/Screen';
import usersAPI from '../api/users'
import { AppForm } from '../components/forms';
import ImageInput from '../components/ImageInput';
import AuthContext from '../auth/context';
import imageApi from '../api/image';
import colors from '../config/colors';
import AppInfoText from '../components/AppInfoText';

function EditAccountDetailsScreen({route, navigation}) {
    const {user, setUser} = useContext(AuthContext);
    const [image, setImage] = useState(user.imageUri);
    const handleChangeImage = async (image) =>{
        setImage(image);
        //now call the api to update the image
        if(image != null){
            try{
                const apiReturn = await imageApi.setImage({image: image, email: user.email });
                //console.log(apiReturn.data);
                //update the user image uri
                setUser({...user, imageUri: apiReturn.data});
            }
            catch(error){
                console.log(error);
            }
        }
    }
    return (
        <Screen style={styles.container}>
            <AppForm >
                <ImageInput imageUri={image} onChangeImage={handleChangeImage} />
                {image == null ? <AppInfoText>Touch the icon to add your pic</AppInfoText>
                : <AppInfoText>Touch image to change your pic</AppInfoText>}
            </AppForm>
        </Screen>
    );
}
const styles = StyleSheet.create({
    container:{
        alignItems: 'center',
        marginTop: 20
    }
})
export default EditAccountDetailsScreen;