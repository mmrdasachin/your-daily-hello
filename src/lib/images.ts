import passCommon from "@/assets/pass-cards/common.webp";
import passRare from "@/assets/pass-cards/rare.webp";
import passEpic from "@/assets/pass-cards/epic.webp";
import passLegend from "@/assets/pass-cards/legend.webp";

const GH_BASE =
  "https://raw.githubusercontent.com/0xDarkSeidBull/nft/main/files/boardpass";

export const HERO_EPIC_IMAGE = `${GH_BASE}/LITDEXEPIC%20HOME.png`;
export const HERO_LEGEND_IMAGE = `${GH_BASE}/LITDEXLEGENDHOME.png`;

export const COMMON_PFP = `${GH_BASE}/cpfp.png`;
export const RARE_PFP = `${GH_BASE}/rpfp.png`;
export const EPIC_PFP = `${GH_BASE}/epfp.png`;
export const LEGEND_PFP = `${GH_BASE}/lpfp.png`;

export const PASS_CARD_IMAGES = [
  { src: passCommon, label: "Common" },
  { src: passRare, label: "Rare" },
  { src: passEpic, label: "Epic" },
  { src: passLegend, label: "Legend" },
];
