"""Build fixed Rubik weights for browser/SVG and PDF from the licensed source TTF.

Requires fonttools: python3 -m pip install fonttools
"""

from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/modules/members/assets/Rubik-VariableFont_wght.ttf"
TARGET = ROOT / "public/fonts/credential"
WEIGHTS = (400, 500, 550, 600, 650, 750)


def main() -> None:
    TARGET.mkdir(parents=True, exist_ok=True)
    for weight in WEIGHTS:
        font = TTFont(SOURCE)
        instantiateVariableFont(font, {"wght": weight}, inplace=True)
        names = font["name"]
        for platform, encoding, language in ((3, 1, 0x409), (1, 0, 0)):
            names.setName("CredentialRubik", 1, platform, encoding, language)
            names.setName(f"Weight {weight}", 2, platform, encoding, language)
            names.setName(f"CredentialRubik Weight {weight}", 4, platform, encoding, language)
            names.setName(f"CredentialRubik-{weight}", 6, platform, encoding, language)
        font["OS/2"].usWeightClass = weight
        font.save(TARGET / f"Rubik-{weight}.ttf")


if __name__ == "__main__":
    main()
