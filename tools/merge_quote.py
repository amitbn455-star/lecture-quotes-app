#!/usr/bin/env python3
"""ממזג הצעה מעודכנת (אחרי הפקת חשבון) לתוך תוכן הגיליון הטרי, בלי לגעת בשום דבר אחר.

שימוש: python3 merge_quote.py <fresh.json> <updated_quote.json> <merged.json>
קודי יציאה: 0 הצליח | 3 ההצעה כבר מחויבת | 4 מספר חשבון תפוס | 5 מבנה לא תקין
"""
import json, sys

fresh_path, upd_path, out_path = sys.argv[1:4]
fresh = json.load(open(fresh_path, encoding='utf-8'))
upd = json.load(open(upd_path, encoding='utf-8'))

quotes = fresh.get('quotes')
if not isinstance(quotes, list) or 'clients' not in fresh:
    print('bad structure'); sys.exit(5)

idx = [i for i, q in enumerate(quotes) if str(q.get('id')) == str(upd.get('id'))]
if len(idx) != 1:
    print('quote not found or duplicated'); sys.exit(5)
i = idx[0]
if quotes[i].get('invoiced') and quotes[i].get('invNum'):
    print('already invoiced: ' + str(quotes[i]['invNum'])); sys.exit(3)
if any(q.get('invNum') == upd.get('invNum') for j, q in enumerate(quotes) if j != i):
    print('invoice number taken: ' + str(upd.get('invNum'))); sys.exit(4)

before = len(quotes)
quotes[i] = upd
assert len(quotes) == before
out = json.dumps(fresh, ensure_ascii=False, separators=(',', ':'))
open(out_path, 'w', encoding='utf-8').write(out)
print('merged ok; quotes=%d clients=%d chars=%d' % (len(quotes), len(fresh['clients']), len(out)))
