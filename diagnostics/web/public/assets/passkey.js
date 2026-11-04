// Browser side of passkey sign-in and registration (WebAuthn).
const b64u = {
  enc: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0)),
};

async function passkeyPost(action, csrf, body = {}) {
  const r = await fetch('/auth/passkey.php?action=' + action, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF': csrf }, body: JSON.stringify(body), credentials: 'same-origin',
  });
  const j = await r.json().catch(() => ({ error: 'Unexpected server response' }));
  if (!r.ok || j.error) throw new Error(j.error || 'Request failed');
  return j;
}

async function passkeyRegister(csrf, label) {
  if (!window.PublicKeyCredential) throw new Error('This browser does not support passkeys.');
  const o = await passkeyPost('register_options', csrf);
  const cred = await navigator.credentials.create({ publicKey: {
    challenge: b64u.dec(o.challenge), rp: o.rp, user: { id: b64u.dec(o.user.id), name: o.user.name, displayName: o.user.displayName },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' }, attestation: 'none', timeout: 60000,
    excludeCredentials: o.exclude.map((id) => ({ type: 'public-key', id: b64u.dec(id) })),
  } });
  return passkeyPost('register_verify', csrf, {
    clientDataJSON: b64u.enc(cred.response.clientDataJSON), attestationObject: b64u.enc(cred.response.attestationObject), label,
  });
}

async function passkeyLogin(csrf) {
  if (!window.PublicKeyCredential) throw new Error('This browser does not support passkeys.');
  const o = await passkeyPost('login_options', csrf);
  const a = await navigator.credentials.get({ publicKey: { challenge: b64u.dec(o.challenge), rpId: o.rpId, userVerification: 'preferred', timeout: 60000 } });
  return passkeyPost('login_verify', csrf, {
    id: b64u.enc(a.rawId), clientDataJSON: b64u.enc(a.response.clientDataJSON),
    authenticatorData: b64u.enc(a.response.authenticatorData), signature: b64u.enc(a.response.signature),
  });
}
