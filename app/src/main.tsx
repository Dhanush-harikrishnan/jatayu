import { createRoot } from 'react-dom/client'
import { Amplify } from 'aws-amplify'
import './index.css'
import App from './App.tsx'

// Polyfill for AWS Amplify Liveness WebRTC in Vite
if (typeof window !== 'undefined') {
  (window as any).global = window;
}

// Configure AWS Amplify with Cognito Identity Pool for FaceLivenessDetector
Amplify.configure({
  Auth: {
    Cognito: {
      identityPoolId: import.meta.env.VITE_AWS_COGNITO_IDENTITY_POOL_ID,
      allowGuestAccess: true, // Required for unauthenticated Rekognition streaming
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <App />
)
