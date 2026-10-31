import Svg, { G, Rect } from "react-native-svg";
import { usePalette } from "./theme";

/** The Trainova mark (public/icon.svg): a lime tile with the cable-machine glyph. */
export function Logo({ size = 32 }: { size?: number }) {
  const p = usePalette();
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Rect width={512} height={512} rx={112} fill={p.accentFill} />
      <G fill={p.onAccent} transform="translate(20.5 20.5) scale(0.92)">
        <Rect x={78} y={112} width={44} height={124} rx={14} />
        <Rect x={130} y={134} width={30} height={80} rx={10} />
        <Rect x={352} y={134} width={30} height={80} rx={10} />
        <Rect x={390} y={112} width={44} height={124} rx={14} />
        <Rect x={150} y={154} width={212} height={40} rx={10} />
        <Rect x={224} y={174} width={64} height={230} rx={32} />
      </G>
    </Svg>
  );
}
