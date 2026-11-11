import type { CSSProperties } from "react";
import { ICONS, type IconName } from "./icons";

interface Props { name: IconName; color?: string; size?: number; className?: string }

export function Icon({ name, color, size, className }: Props) {
  const style = { ...(color ? { "--c": color } : {}), ...(size ? { width: size, height: size } : {}) } as CSSProperties;
  return <svg className={`ico ${className ?? ""}`} viewBox="0 0 24 24" aria-hidden="true" style={style} dangerouslySetInnerHTML={{ __html: ICONS[name] }} />;
}
