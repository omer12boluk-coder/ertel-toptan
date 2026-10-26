# DHL (MNG) servis denemesi — SADECE sorgu metotları; doğru ve bilerek yanlış şifreyle cevapları karşılaştırır. Şifre çıktıya yazılmaz.
import os, re, html, urllib.request, datetime
B = 'https://service.mngkargo.com.tr/musterikargosiparis/musterikargosiparis.asmx'
U, P = os.environ.get('U', ''), os.environ.get('P', '')
today = datetime.date.today(); week = today - datetime.timedelta(days=7)
def get(url, data=None, act=None):
    req = urllib.request.Request(url, data=data.encode() if data else None, headers={'Content-Type': 'text/xml; charset=utf-8', **({'SOAPAction': f'"http://tempuri.org/{act}"'} if act else {})})
    try: return urllib.request.urlopen(req, timeout=40).read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e: return f'HTTP {e.code} ' + e.read().decode('utf-8', 'replace')
def sample(op):
    t = get(f'{B}?op={op}'); m = re.findall(r'<pre>(.*?)</pre>', t, re.S)
    x = html.unescape(re.sub(r'<font class=value>(.*?)</font>', r'{\1}', m[0])) if m else ''
    return x[x.index('<?xml'):] if '<?xml' in x else ''
def fill(xml, u, p):
    def f(m):
        tag = m.group(1); low = tag.lower()
        if re.search(r'kullanici|username', low): v = u
        elif re.search(r'sifre|password', low): v = p
        elif 'tarih' in low and ('bit' in low or 'son' in low): v = today.strftime('%d.%m.%Y')
        elif 'tarih' in low: v = week.strftime('%d.%m.%Y')
        elif m.group(2) == 'int': v = '0'
        else: v = 'ERTEL-TEST-0000'
        return f'<{tag}>{html.escape(v)}</{tag}>'
    return re.sub(r'<(\w+)>\{(\w+)\}</\1>', f, xml)
for op in ['KargoBilgileriByReferans', 'FaturaSiparisListesiByTarih', 'MusteriBayiBilgileri', 'KargoTakipByReferans']:
    s = sample(op)
    if not s: print('===', op, 'örnek alınamadı'); continue
    print('===', op, 'alanlar:', re.findall(r'<(\w+)>\{', s))
    for label, pw in [('DOĞRU şifre', P), ('YANLIŞ şifre', P + 'x9')]:
        r = get(B, fill(s, U, pw), op)
        body = re.sub(r'^.*?<soap:Body>|</soap:Body>.*$', '', r, flags=re.S)
        print('  --', label, ':', body.replace(P, '***')[:900])
