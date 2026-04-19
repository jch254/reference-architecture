import { useState } from 'react';
import { Alert, TextInput, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, Typography, Button, Spacer } from '../components';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;

export default function SignInScreen({ navigation }: Props) {
  const { requestLink } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestLink = async () => {
    if (!email.includes('@')) {
      Alert.alert('Invalid email');
      return;
    }
    const normalised = email.trim().toLowerCase();
    setLoading(true);
    try {
      await requestLink(normalised);
      navigation.navigate('Verify', { email: normalised });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to send link';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenLayout>
      <Typography variant="title">Sign In</Typography>
      <Spacer size={24} />
      <TextInput
        style={styles.input}
        placeholder="Email address"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        value={email}
        onChangeText={setEmail}
      />
      <Spacer />
      <Button title={loading ? 'Sending…' : 'Send Link'} onPress={handleRequestLink} disabled={loading} />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
});
