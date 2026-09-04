import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ReportScreen from './src/screens/ReportScreen'; // Veya dosya konumuna göre './screens/ReportScreen'
import { initDatabase } from './src/database/database';
import HomeScreen from './src/screens/HomeScreen';
import CostScreen from './src/screens/CostScreen';
import RecipeScreen from './src/screens/RecipeScreen';
import OrderScreen from './src/screens/OrderScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await initDatabase(); // Veritabanı ve tablolar burada güvenle kurulur
        setIsDbReady(true);
      } catch (e) {
        console.error('Veritabanı başlatma hatası:', e);
      }
    }
    prepare();
  }, []);

  if (!isDbReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' }}>
        <ActivityIndicator size="large" color="#38808A" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Cost" component={CostScreen} />
        <Stack.Screen name="Recipe" component={RecipeScreen} />
        <Stack.Screen name="Order" component={OrderScreen} />
        <Stack.Screen name="Report" component={ReportScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}