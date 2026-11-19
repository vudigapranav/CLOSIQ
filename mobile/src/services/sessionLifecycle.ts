// The local mobile startup bypasses these V1 entry points. Load the legacy auth
// client only when a caller explicitly enters the account flow.
type Auth = typeof import('./authService');
function legacy(): Auth {
  return require('./authService');
}
export const restoreSession: Auth['restoreSession'] = () => legacy().restoreSession();
export const onAuthStateChange: Auth['onAuthStateChange'] = (callback) =>
  legacy().onAuthStateChange(callback);
export const signOut: Auth['signOut'] = () => legacy().signOut();
