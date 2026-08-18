// Must be the very first import — Supabase's client needs a real URL/crypto
// polyfill in the Hermes/React Native runtime, before anything else (auth
// session restoration in particular) touches it.
import 'react-native-url-polyfill/auto';
import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
