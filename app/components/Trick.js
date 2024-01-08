import React, { useState, useContext } from "react";
import {
	View,
	StyleSheet,
	Text,
	TouchableHighlight,
	TouchableNativeFeedback,
} from "react-native";
import colors from "../config/colors";
import AppButton from "./AppButton";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Swipeable from "react-native-gesture-handler/Swipeable";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AuthContext from "../auth/context";

import trickApi from "../api/trick";

function Trick({
	trick,
	name,
	checked,
	onPress,
	renderRightActions,
	renderLeftActions,
}) {
	const { guest, setGuest } = useContext(AuthContext);
	let initColorState = colors.secondary;
	let initTextColorState = colors.white;
	const [checkedState, setCheckedState] = useState(checked);
	if (checkedState == "Complete") {
		initColorState = colors.primary;
		initTextColorState = colors.black;
	}
	const [colorState, setColorState] = useState(initColorState);
	const [textColorState, setTextColorState] = useState(initTextColorState);
	function onCheck() {
		if (checkedState == "To Do") {
			setColorState(colors.primary);
			setCheckedState("Complete");
			setTextColorState(colors.black);
			//call api to edit trick to "Complete"
			let newTrick = { ...trick, checked: "Complete" };
			//console.log(newTrick);
			if (!guest) {
				trickApi.updateTrick(newTrick);
			} else {
				const updateGuestTrickList = async () => {
					try {
						const jsonValue = await AsyncStorage.getItem("@guest_trick_list");
						let guestList = jsonValue != null ? JSON.parse(jsonValue) : [];
						const index = guestList.findIndex((t) => t.id === trick.id);
						if (index !== -1) {
							guestList[index].checked = "Complete";
							await AsyncStorage.setItem(
								"@guest_trick_list",
								JSON.stringify(guestList)
							);
						}
					} catch (e) {
						console.error(
							"Failed to update guest trick list from AsyncStorage",
							e
						);
					}
				};
				updateGuestTrickList();
			}
		}
		if (checkedState == "Complete") {
			setColorState(colors.secondary);
			setCheckedState("To Do");
			setTextColorState(colors.white);
			//call api to edit trick to "To Do"
			let newTrick = { ...trick, checked: "To Do" };
			if (!guest) {
				trickApi.updateTrick(newTrick);
			} else {
				const updateGuestTrickList = async () => {
					try {
						const jsonValue = await AsyncStorage.getItem("@guest_trick_list");
						let guestList = jsonValue != null ? JSON.parse(jsonValue) : [];
						const index = guestList.findIndex((t) => t.id === trick.id);
						if (index !== -1) {
							guestList[index].checked = "To Do";
							await AsyncStorage.setItem(
								"@guest_trick_list",
								JSON.stringify(guestList)
							);
							//setGuestTrickList(guestList);
						}
					} catch (e) {
						console.error(
							"Failed to update guest trick list from AsyncStorage",
							e
						);
					}
				};
				updateGuestTrickList();
				//console.log(newTrick);
			}
		}
	}
	return (
		<GestureHandlerRootView>
			<Swipeable
				renderRightActions={renderRightActions}
				renderLeftActions={renderLeftActions}
			>
				<TouchableNativeFeedback underlayColor={colors.light} onPress={onPress}>
					<View style={styles.container}>
						<View style={styles.textContainer}>
							<Text style={styles.text}>{name}</Text>
							<Text style={styles.note}>{trick.notes}</Text>
						</View>
						<AppButton
							style={styles.button}
							title={checkedState}
							onPress={onCheck}
							backgroundColor={colorState}
							foregroundColor={textColorState}
						/>
					</View>
				</TouchableNativeFeedback>
			</Swipeable>
		</GestureHandlerRootView>
	);
}
const styles = StyleSheet.create({
	container: {
		width: "100%",
		backgroundColor: colors.white,
		padding: 15,
		border: 1,
		justifyContent: "space-evenly",
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "center",
		flex: 1,
	},
	textContainer: {
		flexDirection: "column",
		flex: 1.2,
		marginRight: 10,
	},
	text: {
		fontSize: 18,
		fontWeight: "bold",
	},
	note: {
		fontWeight: "normal",
		fontSize: 12,
	},
	button: {
		justifyContent: "center",
		alignItems: "center",
		flexDirection: "column",
		flex: 0.8,
	},
});

export default Trick;
