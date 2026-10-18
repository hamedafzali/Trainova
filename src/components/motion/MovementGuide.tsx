"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";
import type { Exercise } from "@/domain/types";

// Lazy wrapper for the 3D guide: three.js only loads on pages that show it,
// and a missing WebGL context falls back to a short message.

const MotionViewer = dynamic(() => import("./MotionViewer"), {
  ssr: false,
  loading: () => <div className="aspect-[4/3] w-full animate-pulse rounded-card bg-night sm:aspect-[16/10]" aria-hidden />,
});

class WebGLBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return <p className="rounded-card bg-night p-6 text-center text-sm text-white/70">3D preview isn’t available on this device.</p>;
    return this.props.children;
  }
}

/** The 3D figure alone, full-bleed, for the exercise screen's hero. */
export function MovementHero({ exercise }: { exercise: Exercise }) {
  return (
    <WebGLBoundary>
      <MotionViewer exercise={exercise} bare />
    </WebGLBoundary>
  );
}

export function MovementGuide({ exercise }: { exercise: Exercise }) {
  return (
    <section className="card space-y-3 p-4 sm:p-6">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-h3 text-ink">Movement guide</h2>
        <span className="text-xs text-muted">Drag to turn</span>
      </div>
      <WebGLBoundary>
        <MotionViewer exercise={exercise} />
      </WebGLBoundary>
      <p className="flex items-center gap-3 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-volt" aria-hidden /> Main muscle
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-chart2" aria-hidden /> Helpers
        </span>
      </p>
    </section>
  );
}
