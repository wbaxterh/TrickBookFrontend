import React, { useState, useEffect, useContext } from "react";
import {
	View,
	StyleSheet,
	Text,
	TouchableOpacity,
	ActivityIndicator,
	ScrollView,
	Modal,
	FlatList,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Screen from "../components/Screen";
import AppText from "../components/AppText";
import AppButton from "../components/AppButton";
import colors from "../config/colors";
import tricksApi from "../api/tricks";
import trickApi from "../api/trick";
import AuthContext from "../auth/context";
import AsyncStorage from "@react-native-async-storage/async-storage";

function SpinTheWheelScreen({ navigation }) {
	const { user, guest } = useContext(AuthContext);
	const [trickLists, setTrickLists] = useState([]);
	const [selectedList, setSelectedList] = useState(null);
	const [tricks, setTricks] = useState([]);
	const [currentTrick, setCurrentTrick] = useState(null);
	const [lastTrick, setLastTrick] = useState(null);
	const [isSpinning, setIsSpinning] = useState(false);
	const [score, setScore] = useState({ completed: 0, total: 0 });
	const [loading, setLoading] = useState(true);
	const [dropdownVisible, setDropdownVisible] = useState(false);

	useEffect(() => {
		loadTrickLists();
	}, [user, guest]);

	useEffect(() => {
		if (selectedList) {
			loadTricks();
		}
	}, [selectedList]);

	const loadTrickLists = async () => {
		setLoading(true);
		try {
			if (user && typeof user === 'object' && (user._id || user.userId) && !guest) {
				const userId = user._id || user.userId;
				const response = await tricksApi.getTricks(userId);
				if (response.ok && response.data) {
					setTrickLists(response.data);
					// Auto-select the latest trick list
					if (response.data.length > 0) {
						setSelectedList(response.data[0]);
					}
				} else {
					console.error("Failed to load trick lists", response.problem);
					setTrickLists([]);
				}
			} else {
				// Guest mode or no user - create a default trick list
				const defaultGuestList = {
					id: "guest_default",
					name: "My Tricks",
					_id: "guest_default"
				};
				setTrickLists([defaultGuestList]);
				setSelectedList(defaultGuestList);
			}
		} catch (e) {
			console.error("Failed to load trick lists", e);
			setTrickLists([]);
		} finally {
			setLoading(false);
		}
	};

	const loadTricks = async () => {
		if (!selectedList) return;

		try {
			if (user && typeof user === 'object' && (user._id || user.userId) && !guest) {
				const response = await trickApi.getTrick(selectedList._id);
				if (response.ok && response.data) {
					setTricks(response.data);
				} else {
					console.error("Failed to load tricks", response.problem);
					setTricks([]);
				}
			} else {
				// Guest mode or no user - load from AsyncStorage
				const jsonValue = await AsyncStorage.getItem("@guest_trick_list");
				const allTricks = jsonValue != null ? JSON.parse(jsonValue) : [];
				// For guest mode, all tricks belong to the default list
				setTricks(allTricks);
			}
		} catch (e) {
			console.error("Failed to load tricks", e);
			setTricks([]);
		}
	};

	const spinWheel = () => {
		if (tricks.length === 0) return;

		setIsSpinning(true);
		setCurrentTrick(null);

		// Simulate spinning animation
		setTimeout(() => {
			// Simple random selection from all tricks
			const randomIndex = Math.floor(Math.random() * tricks.length);
			const selectedTrick = tricks[randomIndex];

			// Only update if we have a valid trick
			if (selectedTrick) {
				setCurrentTrick(selectedTrick);
				setLastTrick(selectedTrick);
				// Score will be incremented when Complete or Fail is pressed
			}
			setIsSpinning(false);
		}, 2000); // 2 second spin animation
	};

	const handleComplete = () => {
		setScore((prev) => ({ 
			...prev, 
			completed: prev.completed + 1,
			total: prev.total + 1 
		}));
		setCurrentTrick(null);
	};

	const handleFail = () => {
		setScore((prev) => ({ ...prev, total: prev.total + 1 }));
		setCurrentTrick(null);
	};

	const handleSpinAgain = () => {
		// Don't increment score, just spin again
		spinWheel();
	};

	if (loading) {
		return (
			<Screen style={styles.container}>
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color={colors.primary} />
					<AppText style={styles.loadingText}>Loading trick lists...</AppText>
				</View>
			</Screen>
		);
	}

	return (
		<Screen style={styles.container}>
			<ScrollView showsVerticalScrollIndicator={false}>
				<AppText style={styles.title}>Spin the Wheel</AppText>

				{/* Score Display */}
				<View style={styles.scoreContainer}>
					<AppText style={styles.scoreText}>
						Score: {score.completed} / {score.total}
					</AppText>
				</View>

				{/* Trick List Selector */}
				<TouchableOpacity 
					style={styles.dropdownButton}
					onPress={() => setDropdownVisible(true)}
				>
					<AppText style={styles.dropdownButtonText}>
						{selectedList ? selectedList.name : "Select a Trick List"}
					</AppText>
					<MaterialCommunityIcons 
						name="chevron-down" 
						size={24} 
						color={colors.medium} 
					/>
				</TouchableOpacity>

				{/* Dropdown Modal */}
				<Modal
					visible={dropdownVisible}
					transparent={true}
					animationType="fade"
					onRequestClose={() => setDropdownVisible(false)}
				>
					<TouchableOpacity 
						style={styles.modalOverlay}
						activeOpacity={1}
						onPress={() => setDropdownVisible(false)}
					>
						<View style={styles.dropdownModal}>
							<FlatList
								data={trickLists}
								keyExtractor={(item) => (item._id || item.id).toString()}
								renderItem={({ item }) => (
									<TouchableOpacity
										style={[
											styles.dropdownItem,
											selectedList?._id === item._id || selectedList?.id === item.id
												? styles.dropdownItemSelected
												: null,
										]}
										onPress={() => {
											setSelectedList(item);
											setCurrentTrick(null);
											setDropdownVisible(false);
										}}
									>
										<AppText style={styles.dropdownItemText}>{item.name}</AppText>
									</TouchableOpacity>
								)}
							/>
						</View>
					</TouchableOpacity>
				</Modal>

				{/* Spinning Wheel Area */}
				<View style={styles.wheelContainer}>
					{isSpinning ? (
						<View style={styles.spinningContainer}>
							<ActivityIndicator size="large" color={colors.primary} />
							<AppText style={styles.spinningText}>Spinning...</AppText>
						</View>
					) : currentTrick ? (
						<View style={styles.trickContainer}>
							<AppText style={styles.trickName}>{currentTrick.name}</AppText>
							{currentTrick.notes && (
								<AppText style={styles.trickNotes}>{currentTrick.notes}</AppText>
							)}
						</View>
					) : (
						<View style={styles.emptyContainer}>
							<AppText style={styles.emptyText}>
								{tricks.length === 0
									? "No tricks in this list"
									: "Press Spin to get a trick!"}
							</AppText>
						</View>
					)}
				</View>

				{/* Action Buttons */}
				{!isSpinning && currentTrick ? (
					<>
						<View style={styles.resultButtons}>
							<AppButton
								title="Complete"
								onPress={handleComplete}
								backgroundColor={colors.primary}
								foregroundColor={colors.black}
								style={styles.resultButton}
							/>
							<AppButton
								title="Fail"
								onPress={handleFail}
								backgroundColor={colors.dark}
								style={styles.resultButton}
							/>
						</View>
						<AppButton
							title="Spin Again"
							onPress={handleSpinAgain}
							backgroundColor={colors.medium}
							style={styles.spinAgainButton}
						/>
					</>
				) : (
					<AppButton
						title="Spin"
						onPress={spinWheel}
						backgroundColor={colors.secondary}
						style={styles.spinButton}
						disabled={isSpinning || tricks.length === 0}
					/>
				)}

				{/* Instructions */}
				{!currentTrick && !isSpinning && (
					<View style={styles.instructions}>
						<AppText style={styles.instructionText}>
							Select a trick list and press Spin to get a random trick challenge!
						</AppText>
					</View>
				)}
			</ScrollView>
		</Screen>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		paddingTop: 20,
		paddingBottom: 20,
		paddingHorizontal: 10,
	},
	title: {
		fontSize: 28,
		fontWeight: "bold",
		textAlign: "center",
		marginBottom: 20,
		color: colors.dark,
	},
	scoreContainer: {
		backgroundColor: colors.light,
		padding: 15,
		borderRadius: 10,
		marginBottom: 20,
		alignItems: "center",
	},
	scoreText: {
		fontSize: 20,
		fontWeight: "600",
		color: colors.dark,
	},
	dropdownButton: {
		backgroundColor: colors.light,
		borderRadius: 10,
		marginBottom: 30,
		paddingHorizontal: 15,
		paddingVertical: 15,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	dropdownButtonText: {
		fontSize: 16,
		color: colors.dark,
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "center",
		alignItems: "center",
	},
	dropdownModal: {
		backgroundColor: colors.white,
		borderRadius: 10,
		width: "80%",
		maxHeight: 300,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 4,
		elevation: 5,
	},
	dropdownItem: {
		paddingHorizontal: 20,
		paddingVertical: 15,
		borderBottomWidth: 1,
		borderBottomColor: colors.light,
	},
	dropdownItemSelected: {
		backgroundColor: colors.light,
	},
	dropdownItemText: {
		fontSize: 16,
		color: colors.dark,
	},
	wheelContainer: {
		minHeight: 200,
		justifyContent: "center",
		alignItems: "center",
		marginBottom: 30,
		backgroundColor: colors.white,
		borderRadius: 20,
		padding: 20,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
	spinningContainer: {
		alignItems: "center",
	},
	spinningText: {
		marginTop: 10,
		fontSize: 18,
		color: colors.medium,
	},
	trickContainer: {
		alignItems: "center",
		padding: 20,
	},
	trickName: {
		fontSize: 24,
		fontWeight: "bold",
		textAlign: "center",
		marginBottom: 10,
		color: colors.dark,
	},
	trickNotes: {
		fontSize: 16,
		textAlign: "center",
		color: colors.medium,
	},
	emptyContainer: {
		alignItems: "center",
		padding: 20,
	},
	emptyText: {
		fontSize: 18,
		color: colors.medium,
		textAlign: "center",
	},
	resultButtons: {
		flexDirection: "row",
		justifyContent: "space-around",
		marginBottom: 20,
	},
	resultButton: {
		width: "45%",
	},
	spinButton: {
		marginBottom: 20,
	},
	instructions: {
		alignItems: "center",
		marginTop: 20,
	},
	instructionText: {
		fontSize: 14,
		color: colors.medium,
		textAlign: "center",
		fontStyle: "italic",
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	loadingText: {
		marginTop: 10,
		fontSize: 16,
		color: colors.medium,
	},
	spinAgainButton: {
		marginTop: 15,
		marginBottom: 10,
	},
});

export default SpinTheWheelScreen;