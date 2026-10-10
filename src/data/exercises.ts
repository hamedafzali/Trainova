import type { Exercise } from "@/domain/types";
import type { Equipment, ExerciseType, Muscle } from "@/domain/taxonomy";

// Shared exercise library. Ids are stable forever — logged sets reference them.
// Each entry: how it is logged (type), what it is done on (equipment + default
// device), which muscles it trains, and three short coaching steps.

type Level = "beginner" | "intermediate" | "advanced";

function ex(
  id: string,
  name: string,
  type: ExerciseType,
  equipment: Equipment,
  device: string | null,
  primary: Muscle,
  secondary: Muscle[],
  compound: boolean,
  level: Level,
  instructions: string[]
): Exercise {
  return {
    id,
    owner: null,
    name,
    type,
    equipment,
    defaultDeviceId: device,
    primaryMuscle: primary,
    secondaryMuscles: secondary,
    isCompound: compound,
    level,
    instructions,
    ...(type === "duration" ? { mode: "time" as const } : {}),
  };
}

const W = "weight_reps" as const;
const BW = "bodyweight_reps" as const;
const WBW = "weighted_bodyweight" as const;
const ABW = "assisted_bodyweight" as const;
const DUR = "duration" as const;
const CARDIO = "cardio" as const;

export const LIBRARY_EXERCISES: Exercise[] = [
  // ── Legs: machines ──────────────────────────────────────────────────────
  ex("e-legpress", "Leg Press", W, "machine", "d-22", "quads", ["glutes", "hamstrings"], true, "beginner", [
    "Sit with your back flat on the pad and feet shoulder-width on the platform.",
    "Lower the platform until your knees reach about 90°.",
    "Press back up through your whole foot without locking your knees.",
  ]),
  ex("e-legcurl", "Seated Leg Curl", W, "machine", "d-25", "hamstrings", ["calves"], false, "beginner", [
    "Line your knees up with the machine's pivot; lock the thigh pad down.",
    "Curl the lower pad down and back as far as you can.",
    "Return slowly until your legs are nearly straight.",
  ]),
  ex("e-legext", "Leg Extension", W, "machine", "d-26", "quads", [], false, "beginner", [
    "Sit back with knees at the pivot and the pad on your lower shins.",
    "Straighten your legs fully and squeeze your quads for a moment.",
    "Lower under control — don't let the stack crash.",
  ]),
  ex("e-lycurl", "Lying Leg Curl", W, "machine", "d-lycurl", "hamstrings", ["calves"], false, "beginner", [
    "Lie face down with the pad just above your heels.",
    "Curl your heels toward your glutes, keeping hips on the bench.",
    "Lower slowly to a full stretch.",
  ]),
  ex("e-hacksquat", "Hack Squat", W, "plate_loaded", "d-hack", "quads", ["glutes", "adductors"], true, "intermediate", [
    "Shoulders under the pads, back flat, feet mid-platform.",
    "Release the safeties and squat until thighs are parallel or lower.",
    "Drive up through your midfoot, keeping your back on the pad.",
  ]),
  ex("e-adduct", "Hip Adduction", W, "machine", "d-adduct", "adductors", [], false, "beginner", [
    "Sit tall with the pads on the inside of your knees.",
    "Squeeze your legs together in a smooth arc.",
    "Let them open slowly to a comfortable stretch.",
  ]),
  ex("e-abduct", "Hip Abduction", W, "machine", "d-abduct", "abductors", ["glutes"], false, "beginner", [
    "Sit tall with the pads on the outside of your knees.",
    "Push your knees apart as far as is comfortable.",
    "Return slowly without letting the weights touch.",
  ]),
  ex("e-calfraise", "Standing Calf Raise", W, "machine", "d-calfst", "calves", [], false, "beginner", [
    "Balls of your feet on the edge, shoulders under the pads.",
    "Lower your heels for a full stretch.",
    "Rise as high as you can and pause at the top.",
  ]),
  ex("e-seatcalf", "Seated Calf Raise", W, "plate_loaded", "d-calfse", "calves", [], false, "beginner", [
    "Sit with knees under the pad and balls of your feet on the block.",
    "Lower your heels slowly to a deep stretch.",
    "Push up onto your toes and squeeze.",
  ]),
  ex("e-glutekick", "Glute Kickback Machine", W, "machine", "d-glute", "glutes", ["hamstrings"], false, "beginner", [
    "Brace on the chest pad with one foot on the platform.",
    "Drive the platform back by squeezing your glute.",
    "Return slowly without arching your lower back.",
  ]),
  ex("e-hipthrustm", "Hip Thrust Machine", W, "plate_loaded", "d-hipthr", "glutes", ["hamstrings"], true, "beginner", [
    "Upper back on the pad, belt across your hips, feet flat.",
    "Drive your hips up until your body is straight from knees to shoulders.",
    "Pause and squeeze, then lower under control.",
  ]),

  // ── Legs: free weights / bodyweight ─────────────────────────────────────
  ex("e-squat", "Back Squat", W, "barbell", "d-bb", "quads", ["glutes", "adductors", "lower back"], true, "intermediate", [
    "Bar on your upper back, feet shoulder-width, brace your core.",
    "Sit down between your hips until thighs are at least parallel.",
    "Drive up, keeping your chest up and knees tracking your toes.",
  ]),
  ex("e-frontsquat", "Front Squat", W, "barbell", "d-bb", "quads", ["glutes", "abs"], true, "advanced", [
    "Rest the bar on your front delts with elbows high.",
    "Squat down keeping your torso upright.",
    "Drive up while keeping elbows up.",
  ]),
  ex("e-smithsquat", "Smith Machine Squat", W, "smith", "d-smith", "quads", ["glutes"], true, "beginner", [
    "Bar across your upper back, feet slightly in front of the bar.",
    "Unhook and squat to parallel.",
    "Press up and re-rack by rotating the bar.",
  ]),
  ex("e-gobletsquat", "Goblet Squat", W, "dumbbell", "d-db", "quads", ["glutes", "abs"], true, "beginner", [
    "Hold one dumbbell vertically at your chest.",
    "Squat down between your knees, elbows inside them.",
    "Stand up tall, keeping the weight close.",
  ]),
  ex("e-rdl", "Romanian Deadlift", W, "barbell", "d-bb", "hamstrings", ["glutes", "lower back"], true, "intermediate", [
    "Stand tall with the bar at your hips, soft knees.",
    "Push your hips back and slide the bar down your thighs until you feel a hamstring stretch.",
    "Squeeze your glutes to return to standing.",
  ]),
  ex("e-dbrdl", "Dumbbell Romanian Deadlift", W, "dumbbell", "d-db", "hamstrings", ["glutes", "lower back"], true, "beginner", [
    "Hold dumbbells in front of your thighs, soft knees.",
    "Hinge at the hips, keeping the dumbbells close to your legs.",
    "Stand up by driving your hips forward.",
  ]),
  ex("e-lunge", "Dumbbell Walking Lunge", W, "dumbbell", "d-db", "quads", ["glutes", "hamstrings"], true, "beginner", [
    "Hold dumbbells at your sides and stand tall.",
    "Step forward and lower until both knees are near 90°.",
    "Push through the front heel into the next step. Count reps per leg.",
  ]),
  ex("e-splitsquat", "Bulgarian Split Squat", W, "dumbbell", "d-db", "quads", ["glutes"], true, "intermediate", [
    "Rear foot on a bench, front foot a stride ahead.",
    "Lower straight down until the front thigh is near parallel.",
    "Drive up through the front foot. Count reps per leg.",
  ]),
  ex("e-stepup", "Dumbbell Step-up", W, "dumbbell", "d-db", "quads", ["glutes"], true, "beginner", [
    "Hold dumbbells and place one foot on a box or bench.",
    "Step up by pressing through the top foot only.",
    "Step down slowly. Count reps per leg.",
  ]),
  ex("e-hipthrust", "Barbell Hip Thrust", W, "barbell", "d-bb", "glutes", ["hamstrings"], true, "intermediate", [
    "Upper back on a bench, padded bar across your hips.",
    "Drive your hips up until your torso is level.",
    "Squeeze at the top, then lower with control.",
  ]),
  ex("e-kbswing", "Kettlebell Swing", W, "kettlebell", "d-kb", "glutes", ["hamstrings", "lower back"], true, "intermediate", [
    "Hike the kettlebell back between your legs with a flat back.",
    "Snap your hips forward to float it to chest height.",
    "Let it swing back and repeat — power comes from the hips.",
  ]),
  ex("e-bwsquat", "Bodyweight Squat", BW, "bodyweight", null, "quads", ["glutes"], true, "beginner", [
    "Feet shoulder-width, arms forward for balance.",
    "Sit down and back until thighs are parallel.",
    "Stand up tall and squeeze your glutes.",
  ]),
  ex("e-glutebridge", "Glute Bridge", BW, "bodyweight", null, "glutes", ["hamstrings"], false, "beginner", [
    "Lie on your back, knees bent, feet flat.",
    "Drive your hips up until your body is straight from knees to shoulders.",
    "Pause, then lower slowly.",
  ]),

  // ── Chest ───────────────────────────────────────────────────────────────
  ex("e-chestpress", "Chest Press", W, "machine", "d-1", "chest", ["triceps", "shoulders"], true, "beginner", [
    "Adjust the seat so the handles are at mid-chest height.",
    "Press forward until your arms are almost straight.",
    "Return slowly until you feel a stretch across your chest.",
  ]),
  ex("e-inclinepressm", "Incline Chest Press Machine", W, "machine", "d-inclpress", "chest", ["shoulders", "triceps"], true, "beginner", [
    "Set the seat so the handles line up with your upper chest.",
    "Press up and forward, keeping shoulders down.",
    "Lower under control to a stretch.",
  ]),
  ex("e-pecdeck", "Pec Deck Fly", W, "machine", "d-pecdeck", "chest", ["shoulders"], false, "beginner", [
    "Sit with your back flat, elbows slightly bent on the handles.",
    "Bring the handles together in a wide hugging arc.",
    "Open slowly until you feel a stretch.",
  ]),
  ex("e-bench", "Bench Press", W, "barbell", "d-bb", "chest", ["triceps", "shoulders"], true, "intermediate", [
    "Lie with eyes under the bar, shoulder blades pinched, feet planted.",
    "Lower the bar to your mid-chest with elbows at about 45°.",
    "Press up and slightly back to lockout. Use a spotter or safeties.",
  ]),
  ex("e-inclinebench", "Incline Bench Press", W, "barbell", "d-bb", "chest", ["shoulders", "triceps"], true, "intermediate", [
    "Set the bench to 30–45° and grip just outside shoulder width.",
    "Lower the bar to your upper chest.",
    "Press to lockout over your shoulders.",
  ]),
  ex("e-dbbench", "Dumbbell Bench Press", W, "dumbbell", "d-db", "chest", ["triceps", "shoulders"], true, "beginner", [
    "Lie back with a dumbbell in each hand at chest level.",
    "Press up until arms are straight, dumbbells over your chest.",
    "Lower slowly to a deep, comfortable stretch.",
  ]),
  ex("e-dbincline", "Incline Dumbbell Press", W, "dumbbell", "d-db", "chest", ["shoulders", "triceps"], true, "beginner", [
    "Set the bench to 30–45° with dumbbells at your shoulders.",
    "Press up until the dumbbells nearly touch.",
    "Lower under control.",
  ]),
  ex("e-dbfly", "Dumbbell Fly", W, "dumbbell", "d-db", "chest", ["shoulders"], false, "intermediate", [
    "Lie back with dumbbells above your chest, elbows softly bent.",
    "Open your arms wide in an arc until you feel a stretch.",
    "Squeeze them back together over your chest.",
  ]),
  ex("e-cablefly", "Cable Crossover", W, "cable", "d-cable", "chest", ["shoulders"], false, "beginner", [
    "Set the pulleys high and step forward with a staggered stance.",
    "Bring the handles together in front of your hips.",
    "Return slowly with a slight bend in the elbows.",
  ]),
  ex("e-smithbench", "Smith Machine Bench Press", W, "smith", "d-smith", "chest", ["triceps", "shoulders"], true, "beginner", [
    "Position the bench so the bar lowers to your mid-chest.",
    "Unhook, lower to your chest under control.",
    "Press up and re-rack by rotating the bar.",
  ]),
  ex("e-pushup", "Push-up", BW, "bodyweight", null, "chest", ["triceps", "shoulders", "abs"], true, "beginner", [
    "Hands slightly wider than shoulders, body in a straight line.",
    "Lower your chest to just above the floor.",
    "Push back up without letting your hips sag. Use your knees to make it easier.",
  ]),
  ex("e-dip", "Dip", BW, "bodyweight", "d-dip", "chest", ["triceps", "shoulders"], true, "intermediate", [
    "Support yourself on the bars with straight arms.",
    "Lean slightly forward and lower until your upper arms are parallel.",
    "Press back up to straight arms.",
  ]),
  ex("e-weighteddip", "Weighted Dip", WBW, "bodyweight", "d-dip", "chest", ["triceps", "shoulders"], true, "advanced", [
    "Attach weight with a dip belt; log only the added weight.",
    "Lower until your upper arms are parallel.",
    "Press back up to straight arms.",
  ]),
  ex("e-assistdip", "Assisted Dip", ABW, "machine", "d-assist", "chest", ["triceps", "shoulders"], true, "beginner", [
    "Kneel on the pad; the counterweight is how much help you get.",
    "Lower until your upper arms are parallel.",
    "Press up. Progress by lowering the assistance.",
  ]),

  // ── Back ────────────────────────────────────────────────────────────────
  ex("e-pulldown", "Lat Pulldown", W, "machine", "d-4", "lats", ["biceps", "upper back"], true, "beginner", [
    "Grip slightly wider than shoulders; lock your thighs under the pad.",
    "Pull the bar to your upper chest, leading with your elbows.",
    "Let it rise slowly until your arms are straight.",
  ]),
  ex("e-row", "Seated Row", W, "machine", "d-7", "upper back", ["lats", "biceps", "rear delts"], true, "beginner", [
    "Sit tall with chest against the pad or knees slightly bent.",
    "Pull the handles to your stomach and squeeze your shoulder blades.",
    "Reach forward slowly to a stretch.",
  ]),
  ex("e-cablerow", "Seated Cable Row", W, "cable", "d-cable", "upper back", ["lats", "biceps"], true, "beginner", [
    "Sit with a slight knee bend and a neutral spine.",
    "Pull the handle to your lower ribs.",
    "Let your shoulders reach forward on the return without rounding your back.",
  ]),
  ex("e-closepulldown", "Close-Grip Pulldown", W, "cable", "d-cable", "lats", ["biceps"], true, "beginner", [
    "Use a V-handle and lock your thighs under the pad.",
    "Pull the handle to your upper chest, elbows down and back.",
    "Return slowly to straight arms.",
  ]),
  ex("e-straightpd", "Straight-Arm Pulldown", W, "cable", "d-cable", "lats", ["triceps"], false, "intermediate", [
    "Stand facing a high pulley holding a bar with straight arms.",
    "Sweep the bar down to your thighs, keeping arms straight.",
    "Return slowly overhead.",
  ]),
  ex("e-tbarrow", "T-Bar Row", W, "plate_loaded", "d-tbar", "upper back", ["lats", "biceps", "rear delts"], true, "intermediate", [
    "Chest on the pad, grip the handles.",
    "Row the handles toward your ribs.",
    "Lower to a full stretch.",
  ]),
  ex("e-bbrow", "Barbell Row", W, "barbell", "d-bb", "upper back", ["lats", "biceps", "lower back"], true, "intermediate", [
    "Hinge to about 45° with a flat back, bar hanging at your knees.",
    "Row the bar to your lower ribs.",
    "Lower with control, keeping the hinge.",
  ]),
  ex("e-dbrow", "One-Arm Dumbbell Row", W, "dumbbell", "d-db", "lats", ["upper back", "biceps"], true, "beginner", [
    "One knee and hand on a bench, back flat.",
    "Row the dumbbell to your hip.",
    "Lower to a full stretch. Count reps per arm.",
  ]),
  ex("e-deadlift", "Deadlift", W, "barbell", "d-bb", "lower back", ["glutes", "hamstrings", "traps", "forearms"], true, "advanced", [
    "Bar over midfoot, hips back, flat back, grip just outside your legs.",
    "Push the floor away and stand up tall, bar close to your body.",
    "Hinge back down with control. Reset each rep.",
  ]),
  ex("e-trapdeadlift", "Trap Bar Deadlift", W, "trap_bar", "d-trap", "glutes", ["quads", "hamstrings", "lower back", "traps"], true, "intermediate", [
    "Stand inside the bar, grip the handles, flat back.",
    "Drive up through your legs to stand tall.",
    "Lower by pushing your hips back.",
  ]),
  ex("e-pullup", "Pull-up", BW, "bodyweight", "d-pull", "lats", ["biceps", "upper back"], true, "intermediate", [
    "Hang with an overhand grip slightly wider than shoulders.",
    "Pull until your chin passes the bar.",
    "Lower to a full hang under control.",
  ]),
  ex("e-chinup", "Chin-up", BW, "bodyweight", "d-pull", "lats", ["biceps"], true, "intermediate", [
    "Hang with an underhand, shoulder-width grip.",
    "Pull until your chin passes the bar.",
    "Lower to a full hang.",
  ]),
  ex("e-weightedpullup", "Weighted Pull-up", WBW, "bodyweight", "d-pull", "lats", ["biceps", "upper back"], true, "advanced", [
    "Attach weight with a belt; log only the added weight.",
    "Pull until your chin passes the bar.",
    "Lower to a full hang.",
  ]),
  ex("e-assistpullup", "Assisted Pull-up", ABW, "machine", "d-assist", "lats", ["biceps", "upper back"], true, "beginner", [
    "Kneel on the pad; the counterweight is how much help you get.",
    "Pull until your chin passes the bar.",
    "Lower slowly. Progress by reducing the assistance.",
  ]),
  ex("e-invrow", "Inverted Row", BW, "bodyweight", "d-smith", "upper back", ["lats", "biceps"], true, "beginner", [
    "Hang under a bar at waist height, body straight, heels on the floor.",
    "Pull your chest to the bar.",
    "Lower to straight arms. Walk your feet back to make it easier.",
  ]),
  ex("e-backext", "Back Extension Machine", W, "machine", "d-12", "lower back", ["glutes", "hamstrings"], false, "intermediate", [
    "Sit with the pad across your upper back and feet secured.",
    "Extend back until your body is straight.",
    "Return slowly without rounding hard.",
  ]),
  ex("e-hyperext", "45° Back Extension", BW, "bodyweight", "d-hyper", "lower back", ["glutes", "hamstrings"], false, "beginner", [
    "Set the pad just below your hip crease.",
    "Hinge down with a flat back.",
    "Rise until your body is straight — don't over-arch. Hold a plate to add load.",
  ]),
  ex("e-shrug", "Dumbbell Shrug", W, "dumbbell", "d-db", "traps", ["forearms"], false, "beginner", [
    "Stand tall with heavy dumbbells at your sides.",
    "Lift your shoulders straight up toward your ears.",
    "Pause, then lower fully.",
  ]),
  ex("e-facepull", "Face Pull", W, "cable", "d-cable", "rear delts", ["upper back", "traps"], false, "beginner", [
    "Set a rope at face height.",
    "Pull toward your face, splitting the rope and rotating your hands back.",
    "Return slowly.",
  ]),

  // ── Shoulders ───────────────────────────────────────────────────────────
  ex("e-shpressm", "Shoulder Press Machine", W, "machine", "d-shpress", "shoulders", ["triceps"], true, "beginner", [
    "Adjust the seat so the handles are at shoulder height.",
    "Press up until your arms are almost straight.",
    "Lower slowly to shoulder height.",
  ]),
  ex("e-ohp", "Overhead Press", W, "barbell", "d-bb", "shoulders", ["triceps", "abs"], true, "intermediate", [
    "Bar at your collarbones, grip just outside shoulders, glutes tight.",
    "Press the bar straight up, moving your head back then through.",
    "Lower to your collarbones under control.",
  ]),
  ex("e-dbpress", "Seated Dumbbell Press", W, "dumbbell", "d-db", "shoulders", ["triceps"], true, "beginner", [
    "Sit upright with dumbbells at shoulder height.",
    "Press up until the dumbbells nearly touch.",
    "Lower to ear level.",
  ]),
  ex("e-arnold", "Arnold Press", W, "dumbbell", "d-db", "shoulders", ["triceps"], true, "intermediate", [
    "Start with dumbbells at your chin, palms facing you.",
    "Rotate your palms out as you press overhead.",
    "Reverse the motion on the way down.",
  ]),
  ex("e-lateral", "Lateral Raise", W, "dumbbell", "d-db", "shoulders", [], false, "beginner", [
    "Stand tall with light dumbbells at your sides.",
    "Raise them out to shoulder height, elbows soft and leading.",
    "Lower slowly.",
  ]),
  ex("e-latraisem", "Lateral Raise Machine", W, "machine", "d-latraise", "shoulders", [], false, "beginner", [
    "Sit with the pads on the outside of your upper arms.",
    "Raise your elbows to shoulder height.",
    "Lower slowly.",
  ]),
  ex("e-cablelateral", "Cable Lateral Raise", W, "cable", "d-cable", "shoulders", [], false, "intermediate", [
    "Low pulley, stand side-on and take the handle across your body.",
    "Raise your arm out to shoulder height.",
    "Lower slowly. Count reps per arm.",
  ]),
  ex("e-frontraise", "Front Raise", W, "dumbbell", "d-db", "shoulders", [], false, "beginner", [
    "Hold dumbbells in front of your thighs.",
    "Raise them forward to shoulder height.",
    "Lower slowly.",
  ]),
  ex("e-reversefly", "Reverse Pec Deck", W, "machine", "d-pecdeck", "rear delts", ["upper back"], false, "beginner", [
    "Sit facing the pad, arms straight on the handles.",
    "Open your arms back in a wide arc.",
    "Return slowly.",
  ]),
  ex("e-dbreversefly", "Bent-Over Reverse Fly", W, "dumbbell", "d-db", "rear delts", ["upper back"], false, "beginner", [
    "Hinge forward with light dumbbells hanging below your chest.",
    "Raise them out wide, squeezing your shoulder blades.",
    "Lower slowly.",
  ]),
  ex("e-uprightrow", "Cable Upright Row", W, "cable", "d-cable", "shoulders", ["traps"], false, "intermediate", [
    "Hold a bar on the low pulley with a shoulder-width grip.",
    "Pull up along your body until elbows reach shoulder height.",
    "Lower slowly.",
  ]),

  // ── Arms ────────────────────────────────────────────────────────────────
  ex("e-curl", "Dumbbell Curl", W, "dumbbell", "d-db", "biceps", ["forearms"], false, "beginner", [
    "Stand with dumbbells at your sides, palms forward.",
    "Curl up without swinging, elbows pinned.",
    "Lower slowly to straight arms.",
  ]),
  ex("e-hammercurl", "Hammer Curl", W, "dumbbell", "d-db", "biceps", ["forearms"], false, "beginner", [
    "Hold dumbbells with palms facing each other.",
    "Curl up keeping the neutral grip.",
    "Lower slowly.",
  ]),
  ex("e-bbcurl", "Barbell Curl", W, "barbell", "d-bb", "biceps", ["forearms"], false, "beginner", [
    "Shoulder-width underhand grip, elbows at your sides.",
    "Curl the bar up without leaning back.",
    "Lower under control.",
  ]),
  ex("e-ezcurl", "EZ Bar Curl", W, "ez_bar", "d-ez", "biceps", ["forearms"], false, "beginner", [
    "Grip the angled part of the bar, elbows at your sides.",
    "Curl the bar up to your chest.",
    "Lower slowly.",
  ]),
  ex("e-preacher", "Preacher Curl", W, "ez_bar", "d-ez", "biceps", [], false, "beginner", [
    "Upper arms flat on the preacher pad.",
    "Curl the bar up until forearms are vertical.",
    "Lower slowly to almost straight arms.",
  ]),
  ex("e-cablecurl", "Cable Curl", W, "cable", "d-cable", "biceps", ["forearms"], false, "beginner", [
    "Stand facing a low pulley with a bar or rope.",
    "Curl up, keeping elbows still.",
    "Lower under constant tension.",
  ]),
  ex("e-curlm", "Biceps Curl Machine", W, "machine", "d-curlm", "biceps", [], false, "beginner", [
    "Arms flat on the pad, elbows lined up with the pivot.",
    "Curl the handles up.",
    "Lower slowly.",
  ]),
  ex("e-pushdown", "Triceps Pushdown", W, "cable", "d-cable", "triceps", [], false, "beginner", [
    "High pulley with a bar or rope; elbows pinned to your sides.",
    "Push down until your arms are straight.",
    "Let it rise to about 90° at the elbow.",
  ]),
  ex("e-ohcableext", "Overhead Cable Extension", W, "cable", "d-cable", "triceps", [], false, "intermediate", [
    "Face away from the pulley with a rope behind your head.",
    "Extend your arms overhead.",
    "Return slowly to a deep stretch.",
  ]),
  ex("e-skullcrusher", "Skull Crusher", W, "ez_bar", "d-ez", "triceps", [], false, "intermediate", [
    "Lie on a bench holding the bar over your chest.",
    "Bend at the elbows to lower it toward your forehead.",
    "Extend back up, keeping upper arms still.",
  ]),
  ex("e-dbohext", "Dumbbell Overhead Extension", W, "dumbbell", "d-db", "triceps", [], false, "beginner", [
    "Hold one dumbbell overhead with both hands.",
    "Lower it behind your head by bending your elbows.",
    "Extend back up.",
  ]),
  ex("e-trim", "Triceps Extension Machine", W, "machine", "d-trim", "triceps", [], false, "beginner", [
    "Elbows on the pad, lined up with the pivot.",
    "Extend the handles until arms are straight.",
    "Return slowly.",
  ]),
  ex("e-dipm", "Seated Dip Machine", W, "machine", "d-dipm", "triceps", ["chest"], true, "beginner", [
    "Sit tall and grip the handles at your sides.",
    "Press down until your arms are straight.",
    "Let the handles rise slowly.",
  ]),
  ex("e-closebench", "Close-Grip Bench Press", W, "barbell", "d-bb", "triceps", ["chest", "shoulders"], true, "intermediate", [
    "Grip the bar at shoulder width.",
    "Lower to your lower chest with elbows tucked.",
    "Press up to lockout.",
  ]),
  ex("e-benchdip", "Bench Dip", BW, "bodyweight", null, "triceps", ["chest"], false, "beginner", [
    "Hands on a bench behind you, legs out front.",
    "Lower until elbows reach about 90°.",
    "Press back up.",
  ]),
  ex("e-wristcurl", "Wrist Curl", W, "dumbbell", "d-db", "forearms", [], false, "beginner", [
    "Forearms on your thighs, palms up, wrists over your knees.",
    "Curl the weight up with your wrists only.",
    "Lower slowly.",
  ]),
  ex("e-farmer", "Farmer's Carry", DUR, "dumbbell", "d-db", "forearms", ["traps", "abs"], true, "beginner", [
    "Pick up heavy dumbbells and stand tall.",
    "Walk with short, steady steps, shoulders back.",
    "Set them down when your grip starts to fail.",
  ]),

  // ── Core ────────────────────────────────────────────────────────────────
  ex("e-abs", "Ab Crunch Machine", W, "machine", "d-11", "abs", [], false, "beginner", [
    "Sit with the pads on your chest or handles by your head.",
    "Crunch forward by curling your ribs toward your hips.",
    "Return slowly without letting the stack rest.",
  ]),
  ex("e-cablecrunch", "Cable Crunch", W, "cable", "d-cable", "abs", [], false, "intermediate", [
    "Kneel facing a high pulley, rope beside your head.",
    "Crunch down, bringing your elbows toward your knees.",
    "Return slowly; keep your hips still.",
  ]),
  ex("e-rotary", "Torso Rotation", W, "machine", "d-rotary", "obliques", ["abs"], false, "beginner", [
    "Sit and lock your legs in place.",
    "Rotate your torso against the resistance.",
    "Return slowly. Count reps per side.",
  ]),
  ex("e-woodchop", "Cable Woodchop", W, "cable", "d-cable", "obliques", ["abs"], false, "intermediate", [
    "High pulley, stand side-on with arms extended.",
    "Pull diagonally down across your body, rotating your torso.",
    "Return slowly. Count reps per side.",
  ]),
  ex("e-crunch", "Crunch", BW, "bodyweight", null, "abs", [], false, "beginner", [
    "Lie on your back, knees bent, hands by your head.",
    "Curl your shoulders off the floor.",
    "Lower slowly.",
  ]),
  ex("e-legraise", "Hanging Leg Raise", BW, "bodyweight", "d-pull", "abs", ["obliques"], false, "advanced", [
    "Hang from the bar with straight arms.",
    "Raise your legs to hip height or higher without swinging.",
    "Lower slowly. Bend your knees to make it easier.",
  ]),
  ex("e-kneeraise", "Captain's Chair Knee Raise", BW, "bodyweight", "d-dip", "abs", ["obliques"], false, "beginner", [
    "Back against the pad, forearms on the rests.",
    "Bring your knees up to your chest.",
    "Lower slowly.",
  ]),
  ex("e-russiantwist", "Russian Twist", BW, "bodyweight", null, "obliques", ["abs"], false, "beginner", [
    "Sit with knees bent, lean back slightly.",
    "Rotate your torso side to side.",
    "Hold a weight to make it harder. Count each side as a rep.",
  ]),
  ex("e-plank", "Plank", DUR, "bodyweight", null, "abs", ["shoulders"], false, "beginner", [
    "Forearms on the floor, elbows under shoulders.",
    "Hold a straight line from head to heels; squeeze your glutes.",
    "Breathe steadily — stop when your hips start to sag.",
  ]),
  ex("e-sideplank", "Side Plank", DUR, "bodyweight", null, "obliques", ["abs"], false, "beginner", [
    "Lie on your side, elbow under your shoulder.",
    "Lift your hips into a straight line.",
    "Hold, then switch sides.",
  ]),
  ex("e-hollow", "Hollow Hold", DUR, "bodyweight", null, "abs", [], false, "intermediate", [
    "Lie on your back and press your lower back into the floor.",
    "Lift your shoulders and legs a few inches.",
    "Hold without letting your back arch.",
  ]),
  ex("e-deadhang", "Dead Hang", DUR, "bodyweight", "d-pull", "forearms", ["lats"], false, "beginner", [
    "Grip the bar shoulder-width with an overhand grip.",
    "Hang with relaxed shoulders, feet off the floor.",
    "Hold as long as you can keep your grip.",
  ]),
  ex("e-deadbug", "Dead Bug", BW, "bodyweight", null, "abs", [], false, "beginner", [
    "Lie on your back, arms up, knees bent at 90°.",
    "Lower opposite arm and leg toward the floor, back flat.",
    "Return and switch sides. Count each side as a rep.",
  ]),
  ex("e-mountain", "Mountain Climber", DUR, "bodyweight", null, "abs", ["shoulders", "cardio"], true, "beginner", [
    "Start in a high plank.",
    "Drive your knees toward your chest one at a time.",
    "Keep your hips low and move quickly.",
  ]),

  // ── Full body / conditioning ────────────────────────────────────────────
  ex("e-burpee", "Burpee", BW, "bodyweight", null, "full body", ["chest", "quads", "cardio"], true, "intermediate", [
    "Squat down and place your hands on the floor.",
    "Jump your feet back into a plank, then back in.",
    "Jump up with arms overhead.",
  ]),
  ex("e-thruster", "Dumbbell Thruster", W, "dumbbell", "d-db", "full body", ["quads", "shoulders"], true, "intermediate", [
    "Dumbbells at your shoulders, feet shoulder-width.",
    "Squat to parallel.",
    "Drive up and press the dumbbells overhead in one motion.",
  ]),
  ex("e-kbgoblet", "Kettlebell Goblet Squat", W, "kettlebell", "d-kb", "quads", ["glutes", "abs"], true, "beginner", [
    "Hold the kettlebell by the horns at your chest.",
    "Squat down between your knees.",
    "Stand up tall.",
  ]),
  ex("e-bandpullapart", "Band Pull-Apart", BW, "band", "d-band", "rear delts", ["upper back"], false, "beginner", [
    "Hold a band at shoulder height with straight arms.",
    "Pull it apart until it touches your chest.",
    "Return slowly.",
  ]),

  // ── Cardio ──────────────────────────────────────────────────────────────
  ex("e-treadmill", "Treadmill", CARDIO, "cardio_machine", "d-tm", "cardio", [], false, "beginner", [
    "Start at a comfortable walking pace.",
    "Raise speed or incline to reach your target effort.",
    "Cool down for a few minutes at an easy pace.",
  ]),
  ex("e-bike", "Stationary Bike", CARDIO, "cardio_machine", "d-bike", "cardio", ["quads"], false, "beginner", [
    "Set the seat so your knee is slightly bent at the bottom.",
    "Pedal at a steady cadence; adjust resistance for effort.",
    "Finish with a few easy minutes.",
  ]),
  ex("e-rower", "Rowing Machine", CARDIO, "cardio_machine", "d-row", "cardio", ["upper back", "quads"], false, "beginner", [
    "Strap your feet in and grab the handle.",
    "Push with your legs, lean back, then pull to your ribs.",
    "Return in reverse: arms, body, legs.",
  ]),
  ex("e-elliptical", "Elliptical", CARDIO, "cardio_machine", "d-ellip", "cardio", [], false, "beginner", [
    "Step on and hold the moving handles.",
    "Find a smooth rhythm; push and pull with your arms.",
    "Raise resistance to increase effort.",
  ]),
  ex("e-stairs", "Stair Climber", CARDIO, "cardio_machine", "d-stair", "cardio", ["glutes", "quads"], false, "beginner", [
    "Step on and start at a slow speed.",
    "Stand tall with hands resting lightly on the rails.",
    "Increase speed gradually.",
  ]),
];
