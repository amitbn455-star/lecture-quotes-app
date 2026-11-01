// מפיק חשבון עסקה PDF מאותה אפליקציה (אותו עיצוב ואותה לוגיקה), בלי לכתוב כלום לגיליון.
//
// שימוש:
//   node tools/make_invoice.js <data.json> <quoteId> <out.pdf> <out.json>
//
//   data.json  = תוכן התא A1 בגיליון ({quotes, clients})
//   out.pdf    = החשבון
//   out.json   = ההצעה המעודכנת (invNum, invDate, invDue, invGrand, status...) למיזוג חזרה לגיליון
//
// גופן: אם קיימת תיקייה FONT_DIR עם @fontsource/assistant (npm i @fontsource/assistant) משתמשים בו, אחרת בגופן מערכת.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const [dataFile, quoteId, outPdf, outJson] = process.argv.slice(2);
if (!dataFile || !quoteId || !outPdf || !outJson) {
  console.error('usage: node tools/make_invoice.js <data.json> <quoteId> <out.pdf> <out.json>');
  process.exit(2);
}

const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const indexUrl = 'file://' + path.resolve(__dirname, '..', 'index.html');
const fontDir = process.env.FONT_DIR || '/tmp/fonts/node_modules/@fontsource/assistant/files';

function fontCss() {
  const weights = [400, 600, 700, 800];
  const rules = [];
  for (const w of weights) {
    const f = path.join(fontDir, `assistant-hebrew-${w}-normal.woff2`);
    const l = path.join(fontDir, `assistant-latin-${w}-normal.woff2`);
    if (fs.existsSync(f)) {
      rules.push(`@font-face{font-family:'Assistant';font-weight:${w};src:url('file://${f}') format('woff2');unicode-range:U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F;}`);
    }
    if (fs.existsSync(l)) {
      rules.push(`@font-face{font-family:'Assistant';font-weight:${w};src:url('file://${l}') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}`);
    }
  }
  return rules.join('\n');
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ timezoneId: 'Asia/Jerusalem', locale: 'he-IL' });
  const page = await ctx.newPage();

  // הטעינה מקבלת את הנתונים שהועברו; כל שמירה מהדף נבלעת (לא נכתב כלום החוצה)
  await page.route('**/script.google.com/**', route => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 200, contentType: 'text/plain', body: JSON.stringify(data) });
    } else {
      route.fulfill({ status: 200, contentType: 'text/plain', body: '{"ok":true}' });
    }
  });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());

  await page.goto(indexUrl);
  await page.waitForFunction(() => typeof loadOk !== 'undefined' && loadOk === true, null, { timeout: 30000 });

  const css = fontCss();
  if (css) await page.addStyleTag({ content: css });

  const updated = await page.evaluate((qid) => {
    const q = quotes.find(x => String(x.id) === String(qid));
    if (!q) throw new Error('quote not found: ' + qid);
    if (q.invoiced && q.invNum) throw new Error('quote already invoiced: ' + q.invNum);
    currentQ = q;
    openInvoiceFlow();            // ברירות מחדל: מספר חשבון הבא, תאריך היום, +30 יום, הערות
    printMode = 'invoice';
    fillPdfInvoice();             // כותב את שדות החשבון להצעה ובונה את המסמך
    const u = quotes.find(x => String(x.id) === String(qid));
    u.status = 'invoiced';        // כמו "חשבון הוצא" שמסומן ידנית היום
    document.body.classList.add('printing-quote');
    return u;
  }, quoteId);

  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: outPdf, format: 'A4', printBackground: true, preferCSSPageSize: true });
  fs.writeFileSync(outJson, JSON.stringify(updated, null, 2));
  console.log(JSON.stringify({ ok: true, invNum: updated.invNum, invDate: updated.invDate, invGrand: updated.invGrand, client: updated.client }));
  await browser.close();
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
