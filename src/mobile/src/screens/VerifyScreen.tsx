import { useState } from 'react';
import { Alert, TextInput, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, Typography, Button, Spacer } from '../components';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Verify'>;

export default function VerifyScreen({ route }: Props) {
  const { email } = route.params;
  const { verifyAndSignIn } = useAuth();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!otp.trim()) {
      Alert.alert('Enter the token from your email link');
      return;
    }
    setLoading(true);
    try {
      await verifyAndSignIn(email, otp.trim());
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Invalid or expired token';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenLayout>
      <Typography variant="title">Check Your Email</Typography>
      <Spacer size={8} />
      <Typography variant="body">A sign-in link was sent to {email}.</Typography>
      <Spacer size={4} />
      <Typography variant="caption">Copy the token from the link (?t=...) and paste it below.</Typography>
      <Spacer size={24} />
      <TextInput
        style={styles.input}
        placeholder="Paste token here"
        autoCapitalize="none"
        autoCorrect={false}
        value={otp}
        onChangeText={setOtp}
      />
      <Spacer />
      <Button title={loading ? 'Verifying…' : 'Verify'} onPress={handleVerify} disabled={loading} />
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
