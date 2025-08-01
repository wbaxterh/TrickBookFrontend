import React from "react";
import { View, StyleSheet, Text, Image, TouchableOpacity } from "react-native";
import colors from "../config/colors";

function ProfileListItem({ title, image, subTitle, onPress }) {
	return (
		<TouchableOpacity onPress={onPress} activeOpacity={0.7}>
			<View style={styles.container}>
				{image && (
					<Image
						style={styles.image}
						source={image}
					/>
				)}
				<View style={styles.detailsContainer}>
					<Text style={styles.title}>{title}</Text>
					{subTitle && <Text style={styles.subtitle}>{subTitle}</Text>}
				</View>
			</View>
		</TouchableOpacity>
	);
}

const styles = StyleSheet.create({
	container: {
		flexDirection: "row",
		flexWrap: "wrap",
		width: "100%",
		alignItems: "center",
		padding: 15,
		backgroundColor: colors.white,
	},
	detailsContainer: {
		marginLeft: 10,
		justifyContent: "center",
	},
	title: {
		fontSize: 18,
		color: colors.black,
		fontWeight: "500",
	},
	subtitle: {
		fontSize: 12,
		color: colors.black,
	},
	image: {
		width: 70,
		height: 70,
		borderRadius: 35,
		marginRight: 10,
	},
});

export default ProfileListItem;
