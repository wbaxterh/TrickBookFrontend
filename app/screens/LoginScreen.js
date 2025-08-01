import React, { useContext, useState } from "react";
import { StyleSheet, Image } from "react-native";
import * as Yup from "yup";
import jwtDecode from "jwt-decode";

import authApi from "../api/auth";
import usersApi from "../api/users";
import Screen from "../components/Screen";
import {
	ErrorMessage,
	AppForm,
	AppFormField,
	SubmitButton,
} from "../components/forms";
import AuthContext from "../auth/context";
import authStorage from "../auth/storage";

const validationSchema = Yup.object().shape({
	email: Yup.string().required().email().label("Email"),
	password: Yup.string().required().min(4).label("Password"),
});

function LoginScreen(props) {
	const authContext = useContext(AuthContext);
	const [loginFailed, setLoginFailed] = useState(false);
	const handleSubmit = async ({ email, password }) => {
		const result = await authApi.login(email, password);
		if (!result.ok) return setLoginFailed(true);
		setLoginFailed(false);
		
		// Decode JWT to get basic user info
		const decodedUser = jwtDecode(result.data.token);
		
		// Fetch complete user profile including imageUri
		const userProfile = await usersApi.getUser(email);
		if (userProfile.ok) {
			// Merge decoded JWT data with full profile data
			const completeUser = {
				...decodedUser,
				...userProfile.data,
			};
			authContext.setUser(completeUser);
		} else {
			// Fallback to just JWT data if profile fetch fails
			authContext.setUser(decodedUser);
		}

		authStorage.storeToken(result.data.token);
	};
	return (
		<Screen style={styles.container}>
			<Image
				style={styles.logo}
				source={require("../assets/TrickBookLogo.png")}
			/>
			<AppForm
				initialValues={{ email: "", password: "" }}
				onSubmit={handleSubmit}
				validationSchema={validationSchema}
			>
				<ErrorMessage
					error='Invalid email and/or password'
					visible={loginFailed}
				/>
				<AppFormField
					name={"email"}
					icon={"email"}
					placeholder={"Email Address"}
					autoCapitalize={"none"}
					autoCorrect={false}
					keyboardType={"email-address"}
					textContentType={"emailAddress"}
				/>
				<AppFormField
					name={"password"}
					autoCapitalize={"none"}
					autoCorrect={false}
					placeholder={"Password"}
					icon={"lock"}
					textContentType={"password"}
					secureTextEntry
					showPasswordToggle
				/>
				<SubmitButton title={"Login"} />
			</AppForm>
		</Screen>
	);
}
const styles = StyleSheet.create({
	container: {
		marginHorizontal: 10,
	},
	logo: {
		width: 80,
		height: 80,
		alignSelf: "center",
		marginTop: 20,
		marginBottom: 10,
	},
});
export default LoginScreen;
