// Must be the very first import — Supabase's client needs a real URL/crypto
// polyfill in the Hermes/React Native runtime, before anything else (auth
// session restoration in particular) touches it.
import 'react-native-url-polyfill/auto';
import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
// HeyHanger V2 demo builds (EXPO_PUBLIC_HEYHANGER_AI_DEMO=1) open straight into the
// on-device AI demo with no sign-in; every other build is the normal app.
const Root =
  process.env.EXPO_PUBLIC_HEYHANGER_AI_DEMO === '1'
    ? (require('./src/demo/AiDemoApp') as typeof import('./src/demo/AiDemoApp')).AiDemoApp
    : App;
registerRootComponent(Root);
