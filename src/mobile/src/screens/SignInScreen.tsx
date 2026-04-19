import { useState } from 'react';
import { Alert, TextInput, StyleSheet } from 'react-native';
import { ScreenLayout, Typography, Button, Spacer } from '../components';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email.includes('@')) {
      Alert.alert('Invalid email');
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim().toLowerCase());
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Sign in failed';
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
      <Button title={loading ? 'Signing in…' : 'Sign In'} onPress={handleSignIn} disabled={loading} />
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
