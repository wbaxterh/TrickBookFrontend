import React from 'react';
import AppButton from '../AppButton';
import colors from '../../config/colors';

import {useFormikContext} from 'formik';
function SubmitButton({title}) {
    const {handleSubmit} = useFormikContext();
    return (
        <AppButton 
                    foregroundColor={colors.black}
                    title={title} 
                    onPress={handleSubmit}
                    />
    );
}

export default SubmitButton;