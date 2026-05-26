import type { TeamName } from "./teams";

export type WcGroup = {
  name: string;
  teams: TeamName[];
};

export const WC2026_GROUPS: WcGroup[] = [
  { name: "A", teams: ["Mexico", "South Africa", "South Korea", "Czech Republic"] },
  { name: "B", teams: ["Canada", "Bosnia and Herzegovina", "Qatar", "Switzerland"] },
  { name: "C", teams: ["Brazil", "Morocco", "Haiti", "Scotland"] },
  { name: "D", teams: ["USA", "Paraguay", "Australia", "Turkey"] },
  { name: "E", teams: ["Germany", "Curaçao", "Ivory Coast", "Ecuador"] },
  { name: "F", teams: ["Netherlands", "Japan", "Sweden", "Tunisia"] },
  { name: "G", teams: ["Belgium", "Egypt", "Iran", "New Zealand"] },
  { name: "H", teams: ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"] },
  { name: "I", teams: ["France", "Senegal", "Iraq", "Norway"] },
  { name: "J", teams: ["Austria", "Jordan", "Argentina", "Algeria"] },
  { name: "K", teams: ["Portugal", "DR Congo", "Uzbekistan", "Colombia"] },
  { name: "L", teams: ["England", "Croatia", "Ghana", "Panama"] },
];

export function getGroup(name: string): WcGroup | undefined {
  return WC2026_GROUPS.find((g) => g.name === name);
}
