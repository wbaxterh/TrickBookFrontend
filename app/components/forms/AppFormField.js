import React from 'react';
import {useFormik, useFormikContext } from 'formik';

import AppTextInput from '../AppTextInput';
import ErrorMessage from './ErrorMessage';
import { PrivateValueStore } from '@react-navigation/native';

function AppFormField({name, ...otherProps}) {
    const {setFieldTouched, handleChange, errors, touched, values, setFieldValue, setValues} = useFormikContext();
    return (
        <>
            <AppTextInput 
                    value={values[name]}
                    {...otherProps}
                    onBlur={() => setFieldTouched(name)}
                    onChangeText={handleChange(name)} //refers to the initial value
                    />
            <ErrorMessage error={errors[name]} visible={touched[name]} />
        </>
    );
}


export default AppFormField;