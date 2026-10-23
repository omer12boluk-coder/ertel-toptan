import pandas as pd, json, sys
df=pd.read_excel(sys.argv[1])
items=[]
for r in df.itertuples():
    w = float(r.urunum_pro_s_price) if r.urunum_pro_s_price and r.urunum_pro_s_price>0 else None
    items.append({"id":int(r.urun_id),"k":str(r.urun_stok_kod),"c":(int(r.urun_kategori_kod) if pd.notna(r.urun_kategori_kod) else 0),
      "r":float(r.urun_satis_fiyat),"w":w,"n":" ".join(str(r.urun_isim).split()),"cur":{"TL":"TRY"}.get(r.urun_pb,r.urun_pb),
      "s":int(r.urun_stok),"a":int(r.urun_durum)})
json.dump(items,open(sys.argv[2],'w'),ensure_ascii=False,separators=(',',':'))
print(len(items))
