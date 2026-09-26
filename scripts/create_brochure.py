"""Build a two-page A4 landscape brochure. Requires reportlab and pymupdf.
Uses Windows fonts and unchanged app captures in docs/screenshots.
"""
from pathlib import Path
import pymupdf
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/brochure'
OUT.mkdir(parents=True, exist_ok=True)
for name, file in [('Sans','arial.ttf'),('Bold','arialbd.ttf'),('Editorial','georgiai.ttf'),('Chinese','msyh.ttc')]:
    pdfmetrics.registerFont(TTFont(name, str(Path('C:/Windows/Fonts') / file)))
W, H = 1190, 842
PW, PH = landscape(A4)
PDF = OUT / 'chinese-learning-brochure-redesigned.pdf'
c = canvas.Canvas(str(PDF), pagesize=(PW, PH), pageCompression=1)
c.setTitle('Chinese Learning | Familiar words. New possibilities.')
c.setAuthor('Chinese Learning')
FOREST, GREEN, INK, MUTED = '#102B25', '#23634F', '#102B25', '#5F7067'
CREAM, LIME, LAVENDER, WHITE = '#F2F5EE', '#D3FF62', '#D5C9FF', '#FFFFFF'
URL = 'https://13.212.235.9/admin-test'

def rect(x,y,w,h,fill,r=0):
    c.setFillColor(colors.HexColor(fill))
    if r: c.roundRect(x,y,w,h,r,fill=1,stroke=0)
    else: c.rect(x,y,w,h,fill=1,stroke=0)

def text(x,y,s,size=13,font='Sans',fill=INK):
    c.setFillColor(colors.HexColor(fill)); c.setFont(font,size); c.drawString(x,y,s)

def lines(x,y,ss,size=15,leading=23,font='Sans',fill=MUTED):
    for i,s in enumerate(ss): text(x,y-i*leading,s,size,font,fill)

def rule(x,y,xx,yy,fill='#D7DDD1',width=1):
    c.setStrokeColor(colors.HexColor(fill)); c.setLineWidth(width); c.line(x,y,xx,yy)

def circle(x,y,r,fill):
    c.setFillColor(colors.HexColor(fill)); c.circle(x,y,r,fill=1,stroke=0)

def arrow(x,y,length=26):
    rule(x,y,x+length,y,GREEN,1.6)
    rule(x+length-6,y+5,x+length,y,GREEN,1.6)
    rule(x+length-6,y-5,x+length,y,GREEN,1.6)

def brand(x,y,light=False):
    rect(x,y-9,31,31,LIME if light else FOREST,3)
    text(x+5,y-2,'习',21,'Chinese',FOREST if light else CREAM)
    text(x+43,y+1,'Chinese Learning',16,'Bold',CREAM if light else FOREST)

def page():
    c.saveState(); c.scale(PW/W,PH/H); rect(0,0,W,H,CREAM)

def endpage():
    c.restoreState(); c.showPage()

def card(x,y,w,h,angle,shade,hanzi,pinyin,meaning):
    c.saveState(); c.translate(x,y); c.rotate(angle)
    rect(6,-8,w,h,'#ACBBA4',7); rect(0,0,w,h,shade,7)
    text(18,h-29,'A WORD YOU KNOW',8,'Bold',MUTED)
    text(20,h-109,hanzi,57,'Chinese')
    text(20,43,pinyin,14); text(20,23,meaning,10,'Sans',MUTED)
    c.restoreState()

# Cover: the visual connects known vocabulary into an illustrative sentence.
page()
rect(0,0,552,H,FOREST)
brand(48,777,True)
rect(48,674,33,3,LIME)
text(92,670,'YOUR VOCABULARY. ACTIVATED.',11,'Bold',LIME)
text(44,587,'Known words.',63,'Bold',CREAM)
text(42,496,'New',103,'Bold',LIME)
text(44,423,'possibilities.',69,'Bold',LIME)
lines(48,365,['Practice Chinese with the vocabulary','you have already learned.'],20,30,fill=CREAM)
rule(48,288,493,288,'#507165')
text(48,249,'You know more than you think.',19,'Bold',CREAM)
lines(48,217,['Put familiar words into new combinations.','Build confidence, one sentence at a time.'],16,24,fill='#C6D6C7')
rect(48,95,287,48,LIME,3)
text(69,113,'START WITH WHAT YOU KNOW',12,'Bold',FOREST)
c.linkURL(URL,(48,95,335,143),relative=1,thickness=0)
text(48,40,'PERSONAL VOCABULARY  /  SENTENCES  /  FLASHCARDS',9,'Bold','#C6D6C7')
text(603,783,'01  /  FROM WORDS TO SENTENCES',10,'Bold',MUTED)
text(1090,783,'01 / 02',10,'Sans',MUTED)
rect(587,235,568,496,'#E5ECD9',3)
for gx in range(607,1150,28): rule(gx,247,gx,719,'#D4DEC9',0.45)
for gy in range(247,730,28): rule(599,gy,1143,gy,'#D4DEC9',0.45)
card(607,468,147,216,-9,WHITE,'我','wǒ','I / me')
card(800,496,157,224,3,LAVENDER,'喜欢','xǐhuan','to like')
card(984,466,151,216,10,LIME,'中文','Zhōngwén','Chinese')
rule(868,436,868,394,'#7D9788',1.4)
rule(862,401,868,394,'#7D9788',1.4); rule(874,401,868,394,'#7D9788',1.4)
rect(606,246,531,133,FOREST,5)
text(633,343,'A SENTENCE YOU CAN UNDERSTAND',9,'Bold',LIME)
text(632,286,'我喜欢中文。',42,'Chinese',CREAM)
text(961,296,'I like Chinese.',15,'Sans',CREAM)
text(608,217,'Illustrative practice example',9,'Sans',MUTED)
text(606,153,'Less overwhelm.',28,'Bold')
text(606,115,'More momentum.',34,'Bold',GREEN)
text(607,40,'DESIGNED AROUND YOUR LEARNING JOURNEY',9,'Bold',MUTED)
endpage()

# Inside: real product capture, illustrative review card, and learning pathway.
page()
brand(44,780)
text(886,781,'YOUR OWN PACE. YOUR OWN WORDS.',10,'Bold',MUTED)
rule(44,752,1146,752)
text(44,692,'Your vocabulary.',47,'Bold')
text(44,637,'Put it to work.',54,'Bold',GREEN)
lines(777,699,['For learners who feel overwhelmed','by unfamiliar words in practice materials.','Start with your vocabulary. Build from there.'],14,22)
rect(49,183,665,427,'#D3DDCD',5); rect(44,188,665,427,WHITE,5)
rect(44,585,665,30,'#DAE5D3',5); rect(44,585,665,15,'#DAE5D3')
for i,shade in enumerate(['#B0BCB0','#C1CBBA','#D0D7C6']): circle(62+i*13,600,3.3,shade)
text(111,596,'Your learning space',9,'Sans',MUTED)
# Aspect ratio preserved; no cropping or alteration of the source capture.
c.drawImage(ImageReader(str(ROOT/'docs/screenshots/home-desktop.png')),52,198,649,379,preserveAspectRatio=True,anchor='c')
text(44,165,'THE WEB APP  /  Learning home',9,'Bold',MUTED)
rect(735,188,411,427,FOREST,5)
text(759,578,'02  /  FLASHCARDS',10,'Bold',LIME)
text(759,540,'Recall it.',31,'Bold',WHITE)
text(759,497,'Make it stick.',39,'Bold',LIME)
rect(758,316,188,164,LAVENDER,5)
text(778,451,'RECALL / REVEAL',8,'Bold',MUTED)
text(803,386,'学习',43,'Chinese'); text(822,353,'xuéxí',13)
text(805,331,'to learn / study',10,'Sans',MUTED)
text(965,445,'Choose a chapter',12,'Bold',WHITE); text(965,425,'or your favorites.',12,fill=CREAM)
text(965,391,'Recall the word.',12,'Bold',WHITE); text(965,371,'Reveal its meaning.',12,fill=CREAM)
text(965,337,'Listen. Repeat.',12,'Bold',LIME)
text(760,297,'Illustrative review card',8,'Sans','#B6C5B9')
rule(759,275,1122,275,'#4E6557')
lines(759,252,['Review familiar words, then use them','in sentence practice.'],14,21,fill=CREAM)
for x,n,heading,body in [(44,'01','Bring your words','Organize vocabulary by chapter.'),(421,'02','Practice in context','Read sentences. Hear pronunciation.'),(798,'03','Keep it familiar','Review words you want to reinforce.')]:
    rect(x,103,32,32,FOREST,3); text(x+8,115,n,10,'Bold',LIME)
    text(x+42,123,heading,15,'Bold'); text(x+42,102,body,11,'Sans',MUTED)
rect(0,0,W,77,FOREST)
text(44,47,'Familiar words. Real progress.',21,'Bold',LIME)
text(44,25,'WEB APP  /  PHONE & DESKTOP',8,'Bold',CREAM)
text(668,52,'TRY THE LIVE APP',12,'Bold',LIME)
text(668,34,'13.212.235.9/admin-test',11,'Sans',WHITE)
text(668,17,'Temporary testing entry with full administrator access',8,'Sans','#B6C5B9')
rule(988,40,1015,40,LIME,2)
rule(1008,47,1015,40,LIME,2); rule(1008,33,1015,40,LIME,2)
widget=qr.QrCodeWidget(URL,barLevel='M',barBorder=4)
bounds=widget.getBounds(); size=60
drawing=Drawing(size,size,transform=[size/(bounds[2]-bounds[0]),0,0,size/(bounds[3]-bounds[1]),0,0])
rect(1032,9,60,60,WHITE,2)
drawing.add(widget); renderPDF.draw(drawing,c,1032,9)
c.linkURL(URL,(658,13,1099,67),relative=1,thickness=0)
text(1111,29,'02 / 02',9,'Sans',CREAM)
endpage(); c.save()

# Render individual pages and the README overview directly from the vector PDF.
doc=pymupdf.open(PDF)
for i,p in enumerate(doc):
    p.get_pixmap(matrix=pymupdf.Matrix(2.4,2.4),alpha=False).save(OUT/f'chinese-learning-brochure-page-{i+1}.png')
overview=pymupdf.open(); sheet=overview.new_page(width=PW,height=PH*2+16)
for i in range(2):
    sheet.show_pdf_page(pymupdf.Rect(0,i*(PH+16),PW,i*(PH+16)+PH),doc,i)
sheet.get_pixmap(matrix=pymupdf.Matrix(1.6,1.6),alpha=False).save(OUT/'chinese-learning-brochure.png')
print(f'Created {PDF} (two A4 landscape pages) and PNG previews.')
