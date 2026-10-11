import { Redirect } from 'expo-router';

/** OAuth deep-link landing. The auth session already handled the code; just go home. */
export default function AuthCallback() {
  return <Redirect href="/" />;
}
