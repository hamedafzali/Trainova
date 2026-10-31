// Runs inside the guide's WebView. The app sends commands with
// injectJavaScript (window.guide.*) and hears back through postMessage.
import { GymViewer } from "pixelwizards-gym-motion/three";

const post = (msg) => window.ReactNativeWebView?.postMessage(JSON.stringify(msg));
let viewer = null;

function start(opts) {
  try {
    viewer = new GymViewer(document.getElementById("stage"), {
      exercise: opts.exercise,
      view: opts.view ?? "angle",
      playing: opts.playing ?? true,
      background: "#141B25",
      quality: opts.quality ?? "high",
      maxPixelRatio: 2,
      label: opts.label,
      onCue: (cue) => post({ type: "cue", cue }),
    });
    viewer.ready.then(
      () => post({ type: "ready", repSeconds: viewer.repSeconds }),
      (e) => post({ type: "error", message: String(e) }),
    );
  } catch (e) {
    post({ type: "error", message: String(e) });
  }
}

window.guide = {
  play: (on) => viewer && (on ? viewer.play() : viewer.pause()),
  speed: (s) => viewer?.setSpeed(s),
  view: (v) => viewer?.setView(v),
  show: (exercise) => {
    viewer?.setContent({ exercise });
    viewer?.ready.then(() => post({ type: "ready", repSeconds: viewer.repSeconds }));
  },
};

window.addEventListener("error", (e) => post({ type: "error", message: e.message }));
start(window.__GUIDE__ ?? {});
