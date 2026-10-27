import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <div className="narrow" style={{ paddingTop: 56 }}>
      <h1>Privacy</h1>
      <p>This is what the NoJuo account system stores, and nothing else:</p>
      <ul>
        <li>Your username and display name, and when the account was created and last signed in.</li>
        <li>A salted scrypt hash of your password. We never store or see the password itself.</li>
        <li>For each signed-in browser or device: a hash of its session token, a name (the browser name or the device name the app sent), and when it was created, last used and expires.</li>
        <li>For rate limiting, counters keyed by IP address and username. They are deleted after a day.</li>
      </ul>
      <p>We set one cookie, <code>__Host-nj_session</code>, to keep you signed in. There are no analytics or advertising cookies. We do not ask for an email address.</p>
      <p>You can remove any session or device, change your password, or delete your account and everything above from the account page.</p>
    </div>
  );
}
