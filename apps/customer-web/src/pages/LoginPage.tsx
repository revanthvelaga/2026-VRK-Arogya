import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { IconPlus } from '../components/Icons';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { PhoneOtpSignIn } from '../components/PhoneOtpSignIn';
import { googleClientId } from '../lib/googleAuth';
import { firebasePhoneAuthConfigured } from '../lib/firebaseAuth';

interface LocationState {
  from?: { pathname: string };
}

export function LoginPage() {
  const { loginWithGoogle, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user) {
      const from = (location.state as LocationState | null)?.from?.pathname ?? '/';
      navigate(from, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const onGoogleCredential = async (idToken: string) => {
    await loginWithGoogle(idToken);
  };

  const hasGoogle = Boolean(googleClientId);
  const hasOtp = firebasePhoneAuthConfigured;

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="auth-hero">
          <div className="auth-logo">
            <IconPlus size={22} />
          </div>
          <div className="login-eyebrow">Arogya</div>
          <h1>Welcome back</h1>
          <p>Sign in to book a test, track a sample, or view your past bookings.</p>
        </div>

        <div className="auth-primary">
          <GoogleSignInButton onCredential={onGoogleCredential} />
          {hasGoogle && hasOtp && (
            <div className="auth-divider auth-divider--tight">
              <span>or</span>
            </div>
          )}
          <PhoneOtpSignIn />
        </div>

        {!hasGoogle && !hasOtp && (
          <p className="field-hint" style={{ textAlign: 'center', marginTop: 12 }}>
            Sign-in isn't set up on this deployment yet.
          </p>
        )}

        <p style={{ textAlign: 'center', marginTop: 18, marginBottom: 0 }}>
          New here? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
