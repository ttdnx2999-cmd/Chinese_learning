"""Build the Chinese Learning one-page brochure from current app captures."""

from pathlib import Path

import pymupdf
from reportlab.lib import colors
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "brochure"
IMAGES = ROOT / "docs" / "screenshots"
OUT.mkdir(parents=True, exist_ok=True)
PDF = OUT / "chinese-learning-brochure.pdf"

FONT_DIR = Path("C:/Windows/Fonts")
pdfmetrics.registerFont(TTFont("Arial", str(FONT_DIR / "arial.ttf")))
pdfmetrics.registerFont(TTFont("ArialBold", str(FONT_DIR / "arialbd.ttf")))
pdfmetrics.registerFont(TTFont("MicrosoftYaHei", str(FONT_DIR / "msyh.ttc"), subfontIndex=0))

W, H = 1190, 842  # A3 landscape; four catalog-style panels
c = canvas.Canvas(str(PDF), pagesize=(W, H))
c.setTitle("Chinese Learning | Product brochure")

INK = colors.HexColor("#173D37")
MUTED = colors.HexColor("#60746D")
GREEN = colors.HexColor("#1D6557")
MINT = colors.HexColor("#E7F0E8")
CREAM = colors.HexColor("#F7F5E9")
LAVENDER = colors.HexColor("#EDEAF5")
LINE = colors.HexColor("#DFE5DE")


def box(x, y, w, h, color, radius=14):
    c.setFillColor(color)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=0)


def label(x, y, content, size=11, bold=False, color=INK, font=None):
    c.setFillColor(color)
    c.setFont(font or ("ArialBold" if bold else "Arial"), size)
    c.drawString(x, y, content)


def lines(x, y, content, size=11, leading=17, color=MUTED):
    for i, line in enumerate(content):
        label(x, y - i * leading, line, size, color=color)


def image_fit(path, x, y, w, h):
    from PIL import Image

    with Image.open(path) as im:
        iw, ih = im.size
    scale = min(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    c.drawImage(ImageReader(str(path)), x + (w - dw) / 2, y + (h - dh) / 2, dw, dh, mask="auto")


margin = 28
gap = 13
panel = (W - 2 * margin - 3 * gap) / 4
xs = [margin + i * (panel + gap) for i in range(4)]

c.setFillColor(colors.white)
c.rect(0, 0, W, H, fill=1, stroke=0)
for x, shade in zip(xs, [CREAM, colors.HexColor("#F6F8F4"), LAVENDER, MINT]):
    box(x, 33, panel, H - 66, shade, 18)

# Cover
x = xs[0]
label(x + 23, H - 78, "CHINESE LEARNING", 12, True, GREEN)
label(x + 23, H - 133, "Your words.", 30, True)
label(x + 23, H - 171, "Real sentences.", 30, True)
lines(x + 23, H - 213, ["Practice Chinese with vocabulary", "you have already learned."], 14, 22, INK)
box(x + 23, 314, panel - 46, 178, GREEN, 18)
label(x + 41, 431, "Learn", 33, True, colors.white)
label(x + 41, 387, "Connect", 33, True, colors.white)
label(x + 41, 343, "Remember", 33, True, colors.white)
label(x + 23, 253, "Less confusion. More confidence.", 14, True)
lines(x + 23, 225, ["A calmer path from single words", "to meaningful sentence practice."], 11, 18)
label(x + 23, 74, "01  /  THE IDEA", 10, True, GREEN)

# Practice panel
x = xs[1]
label(x + 22, H - 78, "PRACTICE", 11, True, GREEN)
label(x + 22, H - 117, "Start with what", 22, True)
label(x + 22, H - 145, "you know.", 22, True)
lines(x + 22, H - 177, ["Add your vocabulary, choose a", "chapter, and build sentence", "practice around familiar words."], 11, 17)
box(x + 16, 294, panel - 32, 253, colors.white, 12)
image_fit(IMAGES / "home-desktop.png", x + 22, 301, panel - 44, 239)
for i, (num, head, desc) in enumerate([
    ("01", "Bring your words", "Organize vocabulary by chapter."),
    ("02", "Read in context", "Practice sentences and meanings."),
    ("03", "Listen and repeat", "Hear Chinese pronunciation."),
]):
    yy = 247 - i * 58
    label(x + 22, yy, num, 12, True, GREEN)
    label(x + 53, yy, head, 12, True)
    label(x + 53, yy - 17, desc, 10, color=MUTED)
label(x + 22, 74, "02  /  SENTENCES", 10, True, GREEN)

# Flashcards panel
x = xs[2]
label(x + 22, H - 78, "FLASHCARDS", 11, True, GREEN)
label(x + 22, H - 117, "Recall. Reveal.", 22, True)
label(x + 22, H - 145, "Keep going.", 22, True)
lines(x + 22, H - 177, ["Review chapters or favorite words", "before putting them into sentences."], 11, 17)
box(x + 16, 306, panel - 32, 257, colors.white, 12)
image_fit(IMAGES / "chapter-flashcards-desktop.png", x + 22, 313, panel - 44, 243)
for i, (head, desc) in enumerate([
    ("Choose your deck", "Filter by chapter or favorites."),
    ("Test your memory", "Reveal pinyin and meanings."),
    ("Hear the word", "Listen as you review."),
]):
    yy = 263 - i * 59
    box(x + 22, yy - 27, panel - 44, 48, colors.white, 9)
    label(x + 33, yy - 1, head, 11, True)
    label(x + 33, yy - 17, desc, 9, color=MUTED)
label(x + 22, 74, "03  /  REVIEW", 10, True, GREEN)

# Closing panel
x = xs[3]
label(x + 22, H - 78, "BUILT FOR LEARNERS", 11, True, GREEN)
label(x + 22, H - 117, "A practice space", 22, True)
label(x + 22, H - 145, "that grows with you.", 22, True)
lines(x + 22, H - 183, ["For learners who know some Chinese", "but feel overwhelmed when practice", "introduces too many new words."], 11, 17)
box(x + 19, 378, panel - 38, 168, colors.white, 14)
label(x + 37, 505, "WHAT YOU CAN DO", 10, True, GREEN)
for i, text in enumerate(["Study your own vocabulary", "Practice Chinese sentences", "Review chapter flashcards", "Save and revisit favorites"]):
    label(x + 37, 476 - i * 28, "•  " + text, 11)
box(x + 19, 194, panel - 38, 172, GREEN, 14)
label(x + 37, 328, "Practice at your own pace.", 17, True, colors.white)
lines(x + 37, 298, ["A familiar word today can become", "a sentence you understand", "tomorrow."], 11, 18, colors.white)
label(x + 37, 220, "WEB APP  •  PHONE & DESKTOP", 10, True, colors.white)
label(x + 22, 113, "Explore the app", 11, True)
label(x + 22, 92, "github.com/ttdnx2999-cmd/Chinese_learning", 9, color=GREEN)
label(x + 22, 74, "04  /  GET STARTED", 10, True, GREEN)

for x in xs[1:]:
    c.setStrokeColor(LINE)
    c.setDash(4, 5)
    c.line(x - gap / 2, 35, x - gap / 2, H - 35)
c.save()

doc = pymupdf.open(str(PDF))
pix = doc[0].get_pixmap(matrix=pymupdf.Matrix(1.4, 1.4), alpha=False)
pix.save(str(OUT / "chinese-learning-brochure.png"))
print(PDF)
