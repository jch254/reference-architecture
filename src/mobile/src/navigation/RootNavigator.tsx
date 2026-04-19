import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import HomeScreen from '../screens/HomeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SignInScreen from '../screens/SignInScreen';

export type RootStackParamList = {
  SignIn: undefined;
  Home: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </>
        ) : (
          <Stack.Screen name="SignIn" component={SignInScreen} options={{ title: 'Sign In' }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
