# Bundled fonts

The existing font families are bundled so production builds do not depend on Google Fonts responses. Next serves them using `next/font/local`; CSS variables and the used weight ranges are preserved.

Source: [Google Fonts repository at `29b4ec6df2522a8aee279414b78a07910b065874`](https://github.com/google/fonts/tree/29b4ec6df2522a8aee279414b78a07910b065874/ofl). These are unmodified variable TrueType fonts, redistributed with their individual SIL Open Font License notices. Updates are explicit; builds and tests never download them.

Source paths and SHA-256 checksums:

- `SpaceGrotesk.ttf` from `ofl/spacegrotesk/SpaceGrotesk[wght].ttf`: `acad6de1fc93436f5c0f1f4137751ef04f1aea3063e7036535970ffcfbd79f72`.
- `SpaceGrotesk.OFL.txt` from `ofl/spacegrotesk/OFL.txt`: `564ce565c371c5e5bbf286006565a7c9aa55a9f56e7ca58d56e05d649dd61a72`.
- `Inter.ttf` from `ofl/inter/Inter[opsz,wght].ttf`: `29160a80ff49ddcab2c97711247e08b1fab27a484a329ce8b813d820dc559031`.
- `Inter.OFL.txt` from `ofl/inter/OFL.txt`: `5b9321a4298cfeb6b34354164a1c3afc3db114569984c502b9b35d988fd58c57`.
- `JetBrainsMono.ttf` from `ofl/jetbrainsmono/JetBrainsMono[wght].ttf`: `48715a42ec242c21e9f02692891e147d022299a52e48d5e413e1a942193ffeda`.
- `JetBrainsMono.OFL.txt` from `ofl/jetbrainsmono/OFL.txt`: `b2fe5e8987594e9ffd1d2ca52a2f5d73eb8335243893c5d6254b5ad69269591d`.
