import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-page text-center">
      <p className="font-display text-5xl text-brand-accent">404</p>
      <h1 className="text-xl font-medium text-title">This page doesn&apos;t exist</h1>
      <Link href="/" className="text-sm font-medium text-brand-text hover:underline">
        Go to Home
      </Link>
    </div>
  );
}
