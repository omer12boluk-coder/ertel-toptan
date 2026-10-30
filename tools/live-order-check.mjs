const FS='https://firestore.googleapis.com/v1/projects/erteltoptan/databases/(default)/documents/';
const W='https://ertel-b2b-watch.omer-12boluk.workers.dev';
const v=(x)=>x==null?null:'stringValue'in x?x.stringValue:'integerValue'in x?Number(x.integerValue):'doubleValue'in x?x.doubleValue:'mapValue'in x?Object.fromEntries(Object.entries(x.mapValue.fields||{}).map(([k,y])=>[k,v(y)])):'arrayValue'in x?(x.arrayValue.values||[]).map(v):null;
const c0=await (await fetch(FS+'pubcatalog/c0')).json(); const items=v(c0.fields.items); const p=items.find(x=>x.r>0);
const post=async(price)=>{const r=await fetch(W+'/order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'chk'+Date.now()+'abcdef',check:true,order:{items:[{id:p.id,qty:1,price,cur:p.cur||'USD'}],pay:'havale',delivery:{method:'cargo'}}})});return r.status+' '+await r.text();};
console.log('::notice title=Ürün::'+p.id+' '+p.n+' $'+p.r);
console.log('::notice title=Doğru fiyat::'+await post(p.r));
console.log('::notice title=Oynanmış fiyat::'+await post(0.01));
const t0=Date.now(); await post(p.r); console.log('::notice title=Süre (önbellekli)::'+(Date.now()-t0)+' ms');
