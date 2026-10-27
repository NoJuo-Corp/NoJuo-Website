import type { Metadata } from "next";

export const metadata: Metadata = { title: "About" };

export default function About() {
  return (
    <div className="narrow" style={{ paddingTop: 56 }}>
      <h1>About NoJuo</h1>
      <p>NoJuo is a small software company. We build things from first principles: an operating system with its own kernel and file system, a messaging app, an AI coding assistant and a game engine.</p>
      <p>This site is also where your NoJuo account lives. One account works across our products; HorizonOS signs in with it directly.</p>
    </div>
  );
}
