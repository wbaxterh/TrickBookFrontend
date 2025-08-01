# Trick Book App

A React Native mobile application for managing skateboarding trick lists with user authentication and offline capabilities.

## Overview

The Trick Book App allows users to create, manage, and track their progress on skateboarding tricks. The app supports both authenticated users with cloud sync and guest users with local storage functionality.

## Architecture

### Frontend Stack

- **React Native** (v0.70.8) with Expo (v47.0.14)
- **React Navigation** (v6.x) for navigation
- **Apisauce** for API communication
- **AsyncStorage** for local data persistence
- **Jotai** for state management
- **Formik + Yup** for form handling and validation

### Backend Integration

The app connects to a Node.js backend API hosted at `https://api.thetrickbook.com/api`

## Project Structure

```
app/
├── api/                    # API service layer
├── assets/                 # Images and static assets
├── auth/                   # Authentication context and storage
├── components/             # Reusable UI components
├── config/                 # App configuration (colors, styles)
├── navigation/             # Navigation setup and routing
└── screens/                # Screen components
```

## Components Documentation

### Core Components

#### UI Components

- **AppButton** (`app/components/AppButton.js`): Customizable button with theming support
- **AppText** (`app/components/AppText.js`): Styled text component using default app styles
- **AppTextInput** (`app/components/AppTextInput.js`): Custom text input with consistent styling
- **Screen** (`app/components/Screen.js`): Base screen wrapper with safe area handling
- **Icon** (`app/components/Icon.js`): Icon wrapper component

#### List Components

- **ListItem** (`app/components/ListItem.js`): Generic list item component
- **ListItemSeperator** (`app/components/ListItemSeperator.js`): Visual separator for lists
- **ListDelete** (`app/components/ListDelete.js`): Swipe-to-delete action component

#### Trick-Specific Components

- **Trick** (`app/components/Trick.js`): Individual trick item with status toggle and swipe actions
- **TrickDelete** (`app/components/TrickDelete.js`): Delete action for trick items
- **TrickEdit** (`app/components/TrickEdit.js`): Edit action for trick items

#### Form Components

Located in `app/components/forms/`:

- **AppForm** (`AppForm.js`): Form wrapper using Formik
- **AppFormField** (`AppFormField.js`): Form field component
- **ErrorMessage** (`ErrorMessage.js`): Error display component
- **SubmitButton** (`SubmitButton.js`): Form submission button

#### Visual Components

- **RoundedLineBar** (`app/components/RoundedLineBar.js`): Progress bar component
- **RoundedLineCircle** (`app/components/RoundedLineCircle.js`): Circular progress indicator
- **ImageInput** (`app/components/ImageInput.js`): Image picker and upload component

## Navigation Structure

### Main Navigation Flow

The app uses a conditional navigation structure based on authentication state:

1. **AuthNavigator** (`app/navigation/AuthNavigator.js`)

   - Welcome Screen
   - Login Screen
   - Register Screen

2. **AppNavigator** (`app/navigation/AppNavigator.js`) - Authenticated users

   - Bottom tab navigation with:
     - Account tab (AccountNavigator)
     - Add List tab (NewListButton)
     - Trick Lists tab (TrickNavigator)

3. **GuestNavigator** (`app/navigation/GuestNavigator.js`) - Guest users
   - Similar structure but with local storage functionality

### Stack Navigators

#### TrickNavigator (`app/navigation/TrickNavigator.js`)

- My Trick Lists → Tricks → Individual Trick screens
- Modal presentations for editing and adding tricks

#### AccountNavigator (`app/navigation/AccountNavigator.js`)

- Account management and settings screens

### Routes Configuration

All route names are centralized in `app/navigation/routes.js`:

- TRICKS, EDITTRICK, ADDTRICK, TRICKDETAILS
- TRICKLISTS, STATS, LOGIN, REGISTER, SETTINGS
- GUESTTRICKS, TUTORIALS, HOWTO

## Screen Components

### Authentication Screens

- **WelcomeScreen** (`app/screens/WelcomeScreen.js`): App introduction and navigation
- **LoginScreen** (`app/screens/LoginScreen.js`): User authentication
- **RegisterScreen** (`app/screens/RegisterScreen.js`): New user registration

### Main App Screens

- **AccountScreen** (`app/screens/AccountScreen.js`): User profile and account management
- **ListTrickListsScreen** (`app/screens/ListTrickListsScreen.js`): Display all trick lists
- **TrickListScreen** (`app/screens/TrickListScreen.js`): Individual trick list with drag-and-drop
- **CreateTrickListScreen** (`app/screens/CreateTrickListScreen.js`): Create new trick lists

### Trick Management Screens

- **AddTrickScreen** (`app/screens/AddTrickScreen.js`): Add new tricks to lists
- **EditTrickScreen** (`app/screens/EditTrickScreen.js`): Modify existing tricks
- **TrickDetailsScreen** (`app/screens/TrickDetailsScreen.js`): Detailed trick view

### Utility Screens

- **SettingsScreen** (`app/screens/SettingsScreen.js`): App settings and preferences
- **StatsScreen** (`app/screens/StatsScreen.js`): Progress tracking and statistics
- **TutorialScreen** (`app/screens/TutorialScreen.js`): App usage tutorial
- **HowToUse** (`app/screens/HowToUse.js`): Help and instructions

### Guest Mode Screens

- **GuestTrickListScreen** (`app/screens/GuestTrickListScreen.js`): Offline trick list functionality

## Backend Integration

### API Client Configuration

The app uses `apisauce` for API communication with a centralized client configuration:

```javascript
// app/api/client.js
const apiClient = create({
	baseURL: "https://api.thetrickbook.com/api",
});
```

### API Services

#### Authentication (`app/api/auth.js`)

- **login(email, password)**: User authentication endpoint

#### User Management (`app/api/users.js`)

- **addUser(name, email, password)**: User registration
- **getUser(email)**: Retrieve user information
- **deleteUser(user)**: User account deletion

#### Trick Lists (`app/api/tricks.js`)

- **getTricks(userId)**: Fetch user's trick lists
- **addTrickList(trick)**: Create new trick list
- **deleteTrickList(trick)**: Remove trick list
- **editTrickList(trickList)**: Update trick list details

#### Individual Tricks (`app/api/trick.js`)

- **getTrick(listId)**: Fetch tricks from specific list
- **addTrick(trick)**: Add new trick to list
- **deleteTrick(trickId)**: Remove trick
- **updateTrick(trick)**: Update trick status (Complete/To Do)
- **editTrick(trick)**: Modify trick details

#### Image Handling (`app/api/image.js`)

- Image upload and management functionality

### Authentication Flow

The app implements a comprehensive authentication system:

1. **Context Management** (`app/auth/context.js`): React Context for auth state
2. **Token Storage** (`app/auth/storage.js`): Secure token management using Expo SecureStore
3. **JWT Decoding**: User information extraction from tokens
4. **Guest Mode**: Offline functionality with AsyncStorage

### Data Flow

#### Authenticated Users

1. Login → JWT token stored securely
2. API calls include authentication headers
3. Data synced with backend database
4. Real-time updates across devices

#### Guest Users

1. Local storage using AsyncStorage
2. Data persists locally only
3. Option to register and sync data later

## Key Features

### Trick Management

- Create and organize trick lists
- Mark tricks as "To Do" or "Complete"
- Swipe gestures for edit/delete actions
- Drag-and-drop reordering (in development)
- Add notes and details to tricks

### User Experience

- Offline support for guest users
- Smooth navigation with React Navigation
- Form validation with Formik/Yup
- Image picker integration
- Pull-to-refresh functionality

### State Management

- Global auth state with React Context
- Local state management with React hooks
- Persistent storage for offline functionality

## Development Setup

### Prerequisites

- Node.js and npm
- Expo CLI
- iOS Simulator or Android Emulator

### Installation

```bash
npm install
```

### Running the App

```bash
# Start Expo development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run on web
npm run web
```

## Dependencies

### Core Dependencies

- `react-native`: React Native framework
- `expo`: Development platform and services
- `@react-navigation/*`: Navigation libraries
- `apisauce`: HTTP client
- `@react-native-async-storage/async-storage`: Local storage
- `expo-secure-store`: Secure token storage
- `jotai`: State management
- `formik` + `yup`: Form handling and validation

### UI Dependencies

- `react-native-gesture-handler`: Gesture recognition
- `react-native-reanimated`: Animations
- `react-beautiful-dnd`: Drag and drop functionality
- `expo-image-picker`: Image selection
- `expo-image-manipulator`: Image processing

## Configuration Files

- **app.json**: Expo app configuration
- **eas.json**: Expo Application Services configuration
- **metro.config.js**: Metro bundler configuration
- **babel.config.js**: Babel transpiler configuration

## iOS Deployment

### Preparing for Release

1. **Increment Version Number**
   - Update the version in `app.json`:
     ```json
     "version": "1.0.8"  // Increment this for each release
     ```

2. **Build for TestFlight/App Store**
   ```bash
   # Build the iOS app with TestFlight profile
   eas build --platform ios --profile testflight
   ```
   
   This command will:
   - Create an iOS build with the TestFlight distribution profile
   - Automatically increment the iOS build number (configured in `eas.json`)
   - Generate an .ipa file ready for submission

3. **Submit to App Store Connect**
   
   After the build completes, you have two options:
   
   **Option A: Using EAS Submit (Recommended)**
   ```bash
   eas submit -p ios --latest
   ```
   
   **Option B: Using Apple Transporter**
   - Download the .ipa file from the EAS build page
   - Open Apple's Transporter app
   - Sign in with your Apple Developer account
   - Drag and drop the .ipa file
   - Click "Deliver" to upload to App Store Connect

4. **Complete App Store Connect Setup**
   - Log in to [App Store Connect](https://appstoreconnect.apple.com)
   - Select your app
   - Complete any required information
   - Submit for review

### Build Profiles

The app is configured with the following build profiles in `eas.json`:
- **development**: For internal testing with development client
- **preview**: For internal distribution
- **production**: For production builds
- **testflight**: For TestFlight and App Store distribution

## Future Enhancements

- View password when creating or logging into an account
- Complete drag-and-drop reordering implementation
- Enhanced statistics and progress tracking
- Social features and trick sharing
- Offline data sync when network becomes available
- Push notifications for reminders and achievements
