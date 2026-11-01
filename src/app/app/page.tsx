import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Download,
  Globe,
  ListChecks,
  RefreshCw,
  Smartphone,
  Sparkles,
  Timer,
  View,
  WifiOff,
} from "lucide-react";
import { LogoMark } from "@/components/Logo";

/** Public introduction to the native app, with the downloads. Rendered outside the app shell (see AppShell). */

// The newest GitHub release carries the APK under this exact file name.
const ANDROID_APK = "https://github.com/hamedafzali/Trainova/releases/latest/download/trainova.apk";

export const metadata: Metadata = {
  title: "Trainova for Android and iPhone",
  description:
    "Follow a plan, log every set in seconds and watch your strength climb. Get Trainova on your phone.",
};

const FEATURES = [
  { icon: ListChecks, title: "Ready-made programs", body: "Start from a proven plan, or build your own from 100+ exercises." },
  { icon: Timer, title: "Log a set in two taps", body: "Last time's weights are filled in. A rest timer starts on its own." },
  { icon: BarChart3, title: "Automatic progression", body: "Trainova tells you what to lift next time, and when to back off." },
  { icon: View, title: "3D movement guide", body: "See each exercise from the front, side or three-quarter view." },
  { icon: Sparkles, title: "A coach built in", body: "Ask about your training and get answers based on your own log." },
  { icon: WifiOff, title: "Works offline", body: "Log in the gym basement. It syncs when you're back online." },
];

const SHOTS = [
  { src: "/screenshots/phone-home.webp", label: "Today's plan, your week and streak" },
  { src: "/screenshots/phone-workout.webp", label: "Logging a set with the 3D guide open" },
  { src: "/screenshots/phone-progress.webp", label: "Weekly progress and muscle focus" },
];

const FAQ = [
  {
    q: "Do I need an account?",
    a: "No. Continue as a guest and everything stays on your phone. Create an account when you want your log backed up and on more than one device.",
  },
  {
    q: "Does the app sync with the website?",
    a: "Yes. Sign in with the same account in the app and on the web, and your programs, workouts and records follow you.",
  },
  {
    q: "Why does Android ask before installing?",
    a: "The app isn't on Google Play yet, so Android asks you to allow installs from your browser. That's expected for apps downloaded from a website.",
  },
  {
    q: "When is the iPhone app coming?",
    a: "It's on its way to the App Store. Until then, the web app works on iPhone: open it in Safari and choose Share, then Add to Home Screen.",
  },
];

function PhoneShot({ src, label, className = "" }: { src: string; label: string; className?: string }) {
  return (
    <figure className={className}>
      <div className="overflow-hidden rounded-[2rem] border-[6px] border-nightSoft bg-night shadow-[0_30px_60px_-25px_rgb(0_0_0/0.6)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static screenshots */}
        <img src={src} alt={label} width={780} height={1688} loading="lazy" decoding="async" className="block h-auto w-full" />
      </div>
    </figure>
  );
}

export default function AppLandingPage() {
  return (
    <div className="min-h-screen bg-bg">
      <section className="night-card rounded-none">
        <svg
          viewBox="0 0 512 512"
          fill="currentColor"
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-16 -z-10 h-[28rem] w-[28rem] rotate-12 text-white opacity-[0.04]"
        >
          <rect x="78" y="112" width="44" height="124" rx="14" />
          <rect x="130" y="134" width="30" height="80" rx="10" />
          <rect x="352" y="134" width="30" height="80" rx="10" />
          <rect x="390" y="112" width="44" height="124" rx="14" />
          <rect x="150" y="154" width="212" height="40" rx="10" />
          <rect x="224" y="174" width="64" height="230" rx="32" />
        </svg>

        <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-8">
          <Link href="/app" className="flex items-center gap-2.5 font-display text-lg font-extrabold">
            <LogoMark className="h-8 w-8" />
            Trainova
          </Link>
          <Link href="/" className="rounded-control px-3 py-2 text-sm font-semibold text-white/80 transition-colors hover:text-white">
            Open web app
          </Link>
        </header>

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-6 md:grid-cols-[1.1fr_1fr] md:px-8 md:pb-24 md:pt-12">
          <div className="rise text-center md:text-left">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-volt">Strength training, logged</p>
            <h1 className="font-display text-[2.25rem] font-extrabold sm:text-[2.75rem] leading-[1.02] tracking-[-0.03em] md:text-[4.25rem]">
              Your training log,
              <br />
              in your pocket.
            </h1>
            <p className="mx-auto mt-5 max-w-md text-body text-white/75 md:mx-0 md:text-lg">
              Follow a plan, log every set in seconds and watch your strength climb. Now as an app for your phone.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center md:justify-start">
              <a href={ANDROID_APK} className="btn-volt w-full rounded-2xl px-7 py-4 text-[15px] sm:w-auto">
                <Download className="h-5 w-5" aria-hidden />
                Download for Android
              </a>
              <a
                href="#download"
                className="btn w-full rounded-2xl border border-white/15 bg-white/5 px-7 py-4 text-[15px] text-white hover:bg-white/10 sm:w-auto"
              >
                iPhone and web
              </a>
            </div>
            <p className="mt-4 text-body-sm text-white/55">Start as a guest. No account needed.</p>
          </div>

          <div className="relative mx-auto flex w-full max-w-sm justify-center md:max-w-md">
            <div className="pointer-events-none absolute inset-x-6 top-10 -z-10 h-3/4 rounded-full bg-volt/20 blur-3xl" aria-hidden />
            <PhoneShot src={SHOTS[1].src} label={SHOTS[1].label} className="w-[58%] translate-y-6 -rotate-3" />
            <PhoneShot src={SHOTS[0].src} label={SHOTS[0].label} className="-ml-[16%] w-[58%] rotate-3" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
        <p className="eyebrow text-accent">Why Trainova</p>
        <h2 className="mt-3 max-w-xl font-display text-3xl font-extrabold tracking-[-0.025em] text-ink md:text-4xl">
          Everything between you and your next PR.
        </h2>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="card p-6">
              <span className="grid h-11 w-11 place-items-center rounded-control bg-accentSoft text-accent">
                <f.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 font-semibold text-ink">{f.title}</h3>
              <p className="mt-1 text-body text-inkSoft">{f.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
          <p className="eyebrow text-accent">A look inside</p>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-[-0.025em] text-ink md:text-4xl">Built for the gym floor.</h2>
          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {SHOTS.map((s) => (
              <div key={s.src} className="mx-auto w-full max-w-[16rem]">
                <PhoneShot src={s.src} label={s.label} />
                <p className="mt-4 text-center text-body-sm text-inkSoft">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="download" className="mx-auto max-w-6xl scroll-mt-6 px-5 py-16 md:px-8 md:py-24">
        <p className="eyebrow text-accent">Get Trainova</p>
        <h2 className="mt-3 font-display text-3xl font-extrabold tracking-[-0.025em] text-ink md:text-4xl">Pick your device.</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="hero-card flex flex-col">
            <Smartphone className="h-6 w-6 text-volt" aria-hidden />
            <h3 className="mt-4 text-lg font-semibold">Android</h3>
            <p className="mt-1 flex-1 text-body text-white/70">
              Download the app and open the file to install it. Android asks once to allow installs from your browser.
            </p>
            <a href={ANDROID_APK} className="btn-volt mt-6 w-full">
              <Download className="h-4 w-4" aria-hidden />
              Download the APK
            </a>
          </div>
          <div className="card flex flex-col p-5">
            <Smartphone className="h-6 w-6 text-accent" aria-hidden />
            <h3 className="mt-4 text-lg font-semibold text-ink">iPhone</h3>
            <p className="mt-1 flex-1 text-body text-inkSoft">
              Coming to the App Store. Meanwhile, open the web app in Safari and add it to your Home Screen.
            </p>
            <span className="btn-ghost mt-6 w-full cursor-default text-muted">App Store: coming soon</span>
          </div>
          <div className="card flex flex-col p-5">
            <Globe className="h-6 w-6 text-accent" aria-hidden />
            <h3 className="mt-4 text-lg font-semibold text-ink">Web</h3>
            <p className="mt-1 flex-1 text-body text-inkSoft">
              Use Trainova in any browser, on a laptop or a phone. Install it from the browser menu to keep it a tap away.
            </p>
            <Link href="/" className="btn-secondary mt-6 w-full">
              Open the web app
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
        <p className="mt-6 flex items-center gap-2 text-body-sm text-inkSoft">
          <RefreshCw className="h-4 w-4 shrink-0 text-accent" aria-hidden />
          One account works everywhere. Your log syncs between the app and the web.
        </p>
      </section>

      <section className="border-t border-border bg-surface">
        <div className="mx-auto max-w-3xl px-5 py-16 md:px-8 md:py-24">
          <h2 className="font-display text-3xl font-extrabold tracking-[-0.025em] text-ink">Questions</h2>
          <div className="mt-8 divide-y divide-border border-y border-border">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="text-xl leading-none text-muted transition-transform duration-150 group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-3 text-body text-inkSoft">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-10 text-body-sm text-muted sm:flex-row md:px-8">
        <span className="flex items-center gap-2">
          <LogoMark className="h-6 w-6" />
          Trainova
        </span>
        <Link href="/" className="font-semibold text-accent hover:underline">
          Open the web app
        </Link>
      </footer>
    </div>
  );
}
