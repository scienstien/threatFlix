// ---------------------------------------------------------------------------
// ThreatFlix — OAuth Callback Page
// Handles the Google OAuth redirect and sends credentials back to the opener.
// ---------------------------------------------------------------------------

import { useEffect } from "react";

export function OAuthCallbackPage() {
  useEffect(() => {
    // Parse the hash fragment from Google's implicit grant flow
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");

    if (accessToken) {
      // Fetch user info from Google using the access token
      fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then((res) => res.json())
        .then((profile) => {
          // Send the user profile back to the opener window
          if (window.opener) {
            window.opener.postMessage(
              {
                type: "oauth_callback",
                email: profile.email,
                name: profile.name,
              },
              window.location.origin
            );
          }
          // Close the popup after a brief delay
          setTimeout(() => window.close(), 300);
        })
        .catch(() => {
          // If profile fetch fails, close the popup
          window.close();
        });
    } else {
      // No token — close popup
      window.close();
    }
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-deep)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-primary)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "2rem", marginBottom: 16 }}>🔐</div>
        <p style={{ fontSize: "0.95rem", color: "var(--text-secondary)" }}>
          Completing sign in…
        </p>
      </div>
    </div>
  );
}
