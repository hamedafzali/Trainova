import type { Device } from "@/domain/types";

// Shared equipment library. Ids are stable forever (history references them);
// machine numbers are per-gym data an admin can set — only the original gym's
// machines carry one by default.

type DeviceDef = Omit<Device, "owner" | "imageUrl"> & { image?: boolean };

const DEFS: DeviceDef[] = [
  // ── Selectorized machines (original gym, numbered) ──────────────────────
  { id: "d-1", name: "Chest Press", machineNumber: "1", category: "machine", loading: "stack", primaryMuscle: "chest", difficulty: "beginner", image: true, guidance: "Press the handles forward; keep shoulders down and back." },
  { id: "d-4", name: "Lat Pulldown", machineNumber: "4", category: "machine", loading: "stack", primaryMuscle: "lats", difficulty: "beginner", image: true, guidance: "Pull the bar to your upper chest; lead with the elbows." },
  { id: "d-7", name: "Seated Row", machineNumber: "7", category: "machine", loading: "stack", primaryMuscle: "upper back", difficulty: "beginner", image: true, guidance: "Pull the handle to your stomach; squeeze the shoulder blades." },
  { id: "d-11", name: "Ab Crunch Machine", machineNumber: "11", category: "machine", loading: "stack", primaryMuscle: "abs", difficulty: "beginner", image: true, guidance: "Crunch forward with your abs, not your arms." },
  { id: "d-12", name: "Back Extension Machine", machineNumber: "12", category: "machine", loading: "stack", primaryMuscle: "lower back", difficulty: "intermediate", image: true, guidance: "Hinge at the hips and rise to a straight back; don't over-arch." },
  { id: "d-22", name: "Leg Press", machineNumber: "22", category: "machine", loading: "stack", primaryMuscle: "quads", difficulty: "beginner", image: true, guidance: "Push the platform away with both feet; don't lock your knees." },
  { id: "d-25", name: "Seated Leg Curl", machineNumber: "25", category: "machine", loading: "stack", primaryMuscle: "hamstrings", difficulty: "beginner", image: true, guidance: "Curl the pad down with your heels; control the way back up." },
  { id: "d-26", name: "Leg Extension", machineNumber: "26", category: "machine", loading: "stack", primaryMuscle: "quads", difficulty: "beginner", image: true, guidance: "Straighten your legs to lift the pad; pause at the top." },

  // ── Further selectorized machines ───────────────────────────────────────
  { id: "d-pecdeck", name: "Pec Deck / Rear Delt", machineNumber: null, category: "machine", loading: "stack", primaryMuscle: "chest", difficulty: "beginner", guidance: "Face the pad for chest flyes; face the stack for rear delts." },
  { id: "d-inclpress", name: "Incline Chest Press", machineNumber: null, category: "machine", loading: "stack", primaryMuscle: "chest", difficulty: "beginner", guidance: "Set the seat so handles line up with your upper chest." },
  { id: "d-shpress", name: "Shoulder Press Machine", machineNumber: null, category: "machine", loading: "stack", primaryMuscle: "shoulders", difficulty: "beginner", guidance: "Handles at shoulder height; press up without shrugging." },
  { id: "d-latraise", name: "Lateral Raise Machine", machineNumber: null, category: "machine", loading: "stack", primaryMuscle: "shoulders", difficulty: "beginner", guidance: "Raise the pads out to the side, elbows leading." },
  { id: "d-assist", name: "Assisted Pull-up / Dip", machineNumber: null, category: "machine", loading: "stack", primaryMuscle: "lats", difficulty: "beginner", guidance: "More weight = more help. Kneel on the pad and pull up." },
  { id: "d-lycurl", name: "Lying Leg Curl", machineNumber: null, category: "machine", loading: "stack", primaryMuscle: "hamstrings", difficulty: "beginner", guidance: "Hips pressed into the pad; curl heels to glutes." },
  { id: "d-adduct", name: "Hip Adductor", machineNumber: null, category: "machine", loading: "stack", primaryMuscle: "adductors", difficulty: "beginner", guidance: "Squeeze the pads together; control the opening." },
  { id: "d-abduct", name: "Hip Abductor", machineNumber: null, category: "machine", loading: "stack", primaryMuscle: "abductors", difficulty: "beginner", guidance: "Push the pads apart; sit tall." },
  { id: "d-calfst", name: "Standing Calf Raise", machineNumber: null, category: "machine", loading: "stack", primaryMuscle: "calves", difficulty: "beginner", guidance: "Full stretch at the bottom, pause at the top." },
  { id: "d-calfse", name: "Seated Calf Raise", machineNumber: null, category: "machine", loading: "plates", primaryMuscle: "calves", difficulty: "beginner", guidance: "Knees under the pad; drive through the balls of your feet." },
  { id: "d-glute", name: "Glute Kickback Machine", machineNumber: null, category: "machine", loading: "stack", primaryMuscle: "glutes", difficulty: "beginner", guidance: "Drive the pad back with your heel; don't arch your back." },
  { id: "d-hipthr", name: "Hip Thrust Machine", machineNumber: null, category: "machine", loading: "plates", primaryMuscle: "glutes", difficulty: "beginner", guidance: "Belt across hips; drive up until hips are level with knees." },
  { id: "d-rotary", name: "Torso Rotation", machineNumber: null, category: "machine", loading: "stack", primaryMuscle: "obliques", difficulty: "beginner", guidance: "Rotate with your torso, slow and controlled." },
  { id: "d-curlm", name: "Biceps Curl Machine", machineNumber: null, category: "machine", loading: "stack", primaryMuscle: "biceps", difficulty: "beginner", guidance: "Arms flat on the pad; curl without lifting elbows." },
  { id: "d-trim", name: "Triceps Extension Machine", machineNumber: null, category: "machine", loading: "stack", primaryMuscle: "triceps", difficulty: "beginner", guidance: "Elbows fixed on the pad; extend fully." },
  { id: "d-dipm", name: "Seated Dip Machine", machineNumber: null, category: "machine", loading: "stack", primaryMuscle: "triceps", difficulty: "beginner", guidance: "Press the handles down until arms are straight." },

  // ── Plate-loaded ─────────────────────────────────────────────────────────
  { id: "d-hack", name: "Hack Squat", machineNumber: null, category: "machine", loading: "plates", primaryMuscle: "quads", difficulty: "intermediate", guidance: "Back flat on the pad; squat to a comfortable depth." },
  { id: "d-tbar", name: "T-Bar Row", machineNumber: null, category: "machine", loading: "plates", primaryMuscle: "upper back", difficulty: "intermediate", guidance: "Chest on the pad; row the handles to your ribs." },
  { id: "d-smith", name: "Smith Machine", machineNumber: null, category: "machine", loading: "plates", primaryMuscle: null, difficulty: "beginner", guidance: "Guided bar — rotate to unhook; set the safeties first." },

  // ── Free weights ─────────────────────────────────────────────────────────
  { id: "d-bb", name: "Barbell", machineNumber: null, category: "free_weight", loading: "plates", primaryMuscle: null, difficulty: "intermediate", image: true, guidance: "Standard bar is 20 kg. Use collars and set the rack safeties." },
  { id: "d-db", name: "Dumbbells", machineNumber: null, category: "free_weight", primaryMuscle: null, difficulty: "beginner", image: true, guidance: "Log the weight of one dumbbell." },
  { id: "d-kb", name: "Kettlebell", machineNumber: null, category: "free_weight", primaryMuscle: null, difficulty: "beginner", guidance: "Log the weight of one kettlebell." },
  { id: "d-ez", name: "EZ Bar", machineNumber: null, category: "free_weight", loading: "plates", primaryMuscle: null, difficulty: "beginner", guidance: "Angled grip is easier on wrists and elbows." },
  { id: "d-trap", name: "Trap Bar", machineNumber: null, category: "free_weight", loading: "plates", primaryMuscle: null, difficulty: "intermediate", guidance: "Stand inside the hex; neutral grip on the handles." },

  // ── Cable ────────────────────────────────────────────────────────────────
  { id: "d-cable", name: "Cable Tower", machineNumber: null, category: "cable", loading: "stack", primaryMuscle: null, difficulty: "beginner", image: true, guidance: "Adjust the pulley height and pick the right attachment." },

  // ── Bodyweight stations ─────────────────────────────────────────────────
  { id: "d-pull", name: "Pull-up Bar", machineNumber: null, category: "bodyweight", primaryMuscle: null, difficulty: "advanced", image: true, guidance: null },
  { id: "d-dip", name: "Dip Station / Captain's Chair", machineNumber: null, category: "bodyweight", primaryMuscle: null, difficulty: "intermediate", guidance: "Use for dips and knee/leg raises." },
  { id: "d-hyper", name: "45° Hyperextension Bench", machineNumber: null, category: "bodyweight", primaryMuscle: "lower back", difficulty: "beginner", guidance: "Pad just below the hip crease so you can hinge freely." },
  { id: "d-band", name: "Resistance Band", machineNumber: null, category: "bodyweight", primaryMuscle: null, difficulty: "beginner", guidance: null },

  // ── Cardio ───────────────────────────────────────────────────────────────
  { id: "d-tm", name: "Treadmill", machineNumber: null, category: "cardio", primaryMuscle: "cardio", difficulty: "beginner", image: true, guidance: "Start slow; use incline to raise effort without running faster." },
  { id: "d-bike", name: "Stationary Bike", machineNumber: null, category: "cardio", primaryMuscle: "cardio", difficulty: "beginner", guidance: "Seat at hip height; slight bend in the knee at the bottom." },
  { id: "d-row", name: "Rowing Machine", machineNumber: null, category: "cardio", primaryMuscle: "cardio", difficulty: "beginner", guidance: "Legs, then body, then arms — reverse on the way back." },
  { id: "d-ellip", name: "Elliptical", machineNumber: null, category: "cardio", primaryMuscle: "cardio", difficulty: "beginner", guidance: "Stand tall; push and pull the handles." },
  { id: "d-stair", name: "Stair Climber", machineNumber: null, category: "cardio", primaryMuscle: "cardio", difficulty: "beginner", guidance: "Light hands on the rails; don't lean on them." },
];

export const LIBRARY_DEVICES: Device[] = DEFS.map(({ image, ...d }) => ({
  ...d,
  loading: d.loading ?? null,
  owner: null,
  imageUrl: image ? `/devices/${d.id}.svg` : null,
}));
