import { useEffect, useState } from 'react';
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

export function RegisterPage() {
  const { loginWithGoogle, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Arriving through a friend's share link (/register?ref=CODE) carries
  // the code straight into whichever sign-in method they use below —
  // no separate form or field needed for it.
  const [referralCode] = useState(
    () => new URLSearchParams(window.location.search).get('ref')?.toUpperCase() || undefined,
  );

  useEffect(() => {
    if (user) {
      const from = (location.state as LocationState | null)?.from?.pathname ?? '/';
      navigate(from, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const onGoogleCredential = async (idToken: string) => {
    await loginWithGoogle(idToken, referralCode);
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
          <h1>Create your account</h1>
          <p>Book tests, track samples, and keep every report in one place.</p>
        </div>

        <div className="auth-primary">
          <GoogleSignInButton onCredential={onGoogleCredential} />
          {hasGoogle && hasOtp && (
            <div className="auth-divider auth-divider--tight">
              <span>or</span>
            </div>
          )}
          <PhoneOtpSignIn referralCode={referralCode} />
        </div>

        {!hasGoogle && !hasOtp && (
          <p className="field-hint" style={{ textAlign: 'center', marginTop: 12 }}>
            Sign-up isn't set up on this deployment yet.
          </p>
        )}

        {referralCode && (
          <p className="field-hint" style={{ textAlign: 'center', marginTop: 12 }}>
            Referral code <b>{referralCode}</b> will be applied to your new account.
          </p>
        )}

        <p style={{ textAlign: 'center', marginTop: 18, marginBottom: 0 }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
