/*
 * BlinkAm public client configuration.
 *
 * Only PUBLIC / publishable values belong here — this file is served to every
 * browser. Secret keys (Dojah secret key, Supabase service-role key) go in
 * .env (see .env.example) and must only be used server-side.
 */
window.BLINKAM_CONFIG = {
  supabase: {
    url: 'https://efmcugpihystaytfjerg.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmbWN1Z3BpaHlzdGF5dGZqZXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNjY2NTYsImV4cCI6MjA5NDY0MjY1Nn0.G53kxih4lhbo6TfnWhNTLwiP7vgnzWE-rI7G98meErc'
  },

  // Dojah EasyOnboard widget (https://docs.dojah.io/sdks/javascript-library).
  // Use the SANDBOX App ID + public key while testing, and a widget whose
  // flow only contains the text-only NIN lookup step (no selfie/liveness).
  dojah: {
    appId: '',
    publicKey: '',
    widgetId: ''
  },

  routes: {
    afterRegister: 'nin_verification.html',
    afterVerification: 'home_feed.html'
  }
};
