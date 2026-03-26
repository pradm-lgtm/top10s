export const metadata = {
  title: 'Privacy Policy — Ranked',
  description: 'Privacy policy for Ranked (rankedhq.app)',
}

export default function PrivacyPage() {
  return (
    <div style={{ background: '#0a0a0f', minHeight: '100vh', color: '#e5e5e5' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '64px 24px' }}>

        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, color: '#ffffff' }}>
          Privacy Policy
        </h1>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 48 }}>
          Last updated: March 2026
        </p>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#ffffff', marginBottom: 12 }}>Overview</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#aaa' }}>
            Ranked (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates rankedhq.app. This page explains what information
            we collect, how we use it, and your choices. We keep this simple because we
            collect very little data.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#ffffff', marginBottom: 12 }}>Information We Collect</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#aaa', marginBottom: 12 }}>
            <strong style={{ color: '#e5e5e5' }}>Account information.</strong> When you sign in with Google,
            we receive your name, email address, and profile photo from Google. We store your
            display name and avatar to show on your public profile.
          </p>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#aaa', marginBottom: 12 }}>
            <strong style={{ color: '#e5e5e5' }}>Content you create.</strong> Lists, rankings, tier labels,
            and notes you write are stored in our database and may be visible to other users.
          </p>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#aaa' }}>
            <strong style={{ color: '#e5e5e5' }}>Usage data.</strong> We may collect standard web server
            logs (IP address, browser type, pages visited) for security and to understand
            how the site is used. We do not sell this data.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#ffffff', marginBottom: 12 }}>How We Use Your Information</h2>
          <ul style={{ fontSize: 15, lineHeight: 1.9, color: '#aaa', paddingLeft: 20 }}>
            <li>To display your profile and lists on the site</li>
            <li>To authenticate you when you sign in</li>
            <li>To operate and improve the service</li>
            <li>To respond to support requests</li>
          </ul>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#aaa', marginTop: 12 }}>
            We do not sell your personal information or share it with third parties for
            advertising purposes.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#ffffff', marginBottom: 12 }}>Third-Party Services</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#aaa', marginBottom: 12 }}>
            <strong style={{ color: '#e5e5e5' }}>Google OAuth.</strong> We use Google Sign-In for
            authentication. Google&apos;s{' '}
            <a href="https://policies.google.com/privacy" style={{ color: '#e8c547' }}>
              privacy policy
            </a>{' '}
            applies to your use of Google Sign-In.
          </p>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#aaa', marginBottom: 12 }}>
            <strong style={{ color: '#e5e5e5' }}>Supabase.</strong> Our database and authentication
            infrastructure is hosted on Supabase. Data is stored on servers in the United States.
          </p>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#aaa' }}>
            <strong style={{ color: '#e5e5e5' }}>TMDB.</strong> Movie and TV show poster images are
            fetched from The Movie Database (TMDB). We do not share your personal data with TMDB.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#ffffff', marginBottom: 12 }}>Cookies</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#aaa' }}>
            We use a session cookie to keep you signed in. We do not use tracking cookies or
            third-party advertising cookies.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#ffffff', marginBottom: 12 }}>Your Rights</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#aaa' }}>
            You may request deletion of your account and associated data at any time by
            contacting us. Public lists and rankings you have created may remain visible
            unless you delete them before requesting account deletion.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#ffffff', marginBottom: 12 }}>Children&apos;s Privacy</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#aaa' }}>
            Ranked is not directed at children under 13. We do not knowingly collect personal
            information from children under 13.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#ffffff', marginBottom: 12 }}>Changes to This Policy</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#aaa' }}>
            We may update this policy from time to time. The date at the top of this page
            reflects the most recent revision. Continued use of the service after changes
            constitutes acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#ffffff', marginBottom: 12 }}>Contact</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#aaa' }}>
            Questions about this privacy policy? Email us at{' '}
            <a href="mailto:hello@rankedhq.app" style={{ color: '#e8c547' }}>
              hello@rankedhq.app
            </a>
            .
          </p>
        </section>

        <div style={{ marginTop: 64, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <a href="/" style={{ fontSize: 13, color: '#666', textDecoration: 'none' }}>
            ← Back to Ranked
          </a>
        </div>

      </div>
    </div>
  )
}
