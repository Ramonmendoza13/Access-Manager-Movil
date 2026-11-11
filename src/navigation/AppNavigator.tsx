import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../store/authStore';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import ScannerScreen from '../screens/ScannerScreen';
import ProfileSelectorScreen from '../screens/ProfileSelectorScreen';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Scanner: undefined;
  ProfileSelector: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { token, role, profileId, profiles } = useAuth();
  const needsProfileSelection =
    Boolean(token) && role === 'OWNER' && !profileId && profiles.length > 1;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          needsProfileSelection ? (
            <Stack.Screen
              name="ProfileSelector"
              component={ProfileSelectorScreen}
              options={{ headerLeft: () => null, gestureEnabled: false }}
            />
          ) : (
            <>
              <Stack.Screen
                name="Home"
                component={HomeScreen}
                options={{ headerLeft: () => null, gestureEnabled: false }}
              />
              <Stack.Screen name="Scanner" component={ScannerScreen} />
              <Stack.Screen
                name="ProfileSelector"
                component={ProfileSelectorScreen}
                options={{
                  animation: 'slide_from_bottom',
                  presentation: 'modal',
                }}
              />
            </>
          )
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
