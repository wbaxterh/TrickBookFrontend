import React, { useState, useEffect } from "react";
import { FlatList, StyleSheet, TouchableHighlight, View } from "react-native";
import ListItemSeperator from "../components/ListItemSeperator";
import Screen from "../components/Screen";
import Trick from "../components/Trick";
import TrickDelete from "../components/TrickDelete";
import colors from "../config/colors";
import trickApi from "../api/trick";
import routes from "../navigation/routes";
import AppButton from "../components/AppButton";
import TrickEdit from "../components/TrickEdit";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import trick from "../api/trick";

function TrickListScreen({ navigation, route }) {
	let list_id = "";
	if (route.params._id != null) {
		list_id = route.params._id;
	}
	let trickList = route.params;

	// navigation.setParams({ title: "Skate Tricks" })
	const [tricks, setTricks] = useState(""); //id for trick list
	const handleOnDragEnd = (result) => {
		if (!result.destination) return;

		const items = Array.from(tricks);
		const [reorderedItem] = items.splice(result.source.index, 1);
		items.splice(result.destination.index, 0, reorderedItem);

		setTricks(items);
		// Here, call your API to save reordered items in your DB
	};
	const [refreshing, setRefreshing] = useState(false);
	const handleDelete = async (trick) => {
		//Delete trick from state array
		setTricks(tricks.filter((t) => t._id !== trick._id));
		//Call server delete trick from DB
		const responseDelete = await trickApi.deleteTrick(trick._id);
	};
	useEffect(() => {
		loadTricks();
		const reload = navigation.addListener("focus", () => {
			// The screen is focused
			// Call the refresh function
			loadTricks();
		});

		// Return the unsubscribe function to clean up the listener
		return reload;
	}, [navigation]);
	const loadTricks = async () => {
		const response = await trickApi.getTrick(list_id);
		setTricks(response.data);
	};

	return (
		<Screen>
			<FlatList
				data={tricks}
				keyExtractor={(trick) => trick._id}
				renderItem={({ item }) => (
					<Trick
						trick={item}
						name={item.name}
						checked={item.checked}
						onPress={() => navigation.navigate(routes.TRICKDETAILS, item)}
						renderRightActions={() => (
							<TrickDelete onPress={() => handleDelete(item)} />
						)}
						renderLeftActions={() => (
							<TrickEdit
								onPress={() => navigation.navigate(routes.EDITTRICK, item)}
							/>
						)}
					/>
				)}
				ItemSeparatorComponent={() => <ListItemSeperator />}
				refreshing={refreshing}
				onRefresh={() => loadTricks()}
				style={styles.container}
			/>
			<AppButton
				style={styles.btn}
				foregroundColor={colors.dark}
				backgroundColor={colors.primary}
				title="+ Add Trick"
				onPress={() => navigation.navigate(routes.ADDTRICK, trickList)}
			/>
		</Screen>
	);
}
const styles = StyleSheet.create({
	container: {
		backgroundColor: colors.light,
	},
	btn: {
		marginBottom: 20,
	},
});
export default TrickListScreen;
