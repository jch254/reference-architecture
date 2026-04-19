import { Alert } from 'react-native';
import { ScreenLayout, Typography, Button, Spacer } from '../components';
import { useAuth } from '../auth/AuthContext';

export default function SettingsScreen() {
  const { email, signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <ScreenLayout>
      <Typography variant="title">Settings</Typography>
      <Spacer size={16} />
      {email && <Typography variant="body">{email}</Typography>}
      <Spacer size={24} />
      <Button title="Sign Out" onPress={handleSignOut} variant="secondary" />
    </ScreenLayout>
  );
}
