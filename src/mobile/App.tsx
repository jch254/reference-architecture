import { StatusBar, useColorScheme } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setBaseUrl } from './src/api';
import { AuthProvider } from './src/auth/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';

// Configure API base URL — adjust for your environment
setBaseUrl(__DEV__ ? 'http://localhost:3000' : 'https://api.example.com');

const queryClient = new QueryClient();

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SafeAreaProvider>
          <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
          <RootNavigator />
        </SafeAreaProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
