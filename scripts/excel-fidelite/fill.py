import openpyxl, json, sys
SRC=sys.argv[1]
cases = {
 "marge": dict(regime=("Non","Oui"), so_pct=0.3, go_pct=0.2),
 "exoneration": dict(regime=("Oui","Non"), so_pct=0.3, go_pct=0.2),
 "total": dict(regime=("Non","Non"), so_pct=0.8, go_pct=0.2),
}
inputs = dict(prix=300000, eviction=5000, apporteur=12000, ameub=8000, gestion=3000, compta=2400, justice=1500,
  ff=27000, gfa=0, do=4500, hv=15000, lots=[(330000,370000),(290000,320000),(60000,70000)],
  go=[(25000,.2),(40000,.2),(30000,.2)], so=[(18000,.1),(9000,.1),(14000,.1),(12000,.1),(16000,.1),(7000,.1)],
  hon=11000, racc=6000, voirie=9000, surel=0, ext=20000, st=250, sc=210)
for name,c in cases.items():
  wb=openpyxl.load_workbook(SRC); bt=wb["Budget travaux"]; bp=wb["BP en phase faisabilité"]
  bt["F4"]=inputs["st"]; bt["F5"]=inputs["sc"]
  for (r,pr),(m,t) in zip([(7,7),(10,10),(13,13)], inputs["go"]):
    bt[f"E{r}"]=m; bt[f"F{r}"]=t; bt[f"D{pr}"]=c["go_pct"]
  for (r,pr),(m,t) in zip([(17,18),(20,21),(23,24),(26,27),(29,30),(32,33)], inputs["so"]):
    bt[f"E{r}"]=m; bt[f"F{r}"]=t; bt[f"D{pr}"]=c["so_pct"]
  bt["E37"]=inputs["hon"]; bt["E40"]=inputs["racc"]; bt["E44"]=inputs["voirie"]; bt["E47"]=inputs["surel"]; bt["E49"]=inputs["ext"]
  bp["D6"]=inputs["prix"]; bp["D7"]=inputs["eviction"]; bp["D9"]=inputs["apporteur"]; bp["D15"]=inputs["ameub"]
  bp["D21"]=inputs["gestion"]; bp["D22"]=inputs["compta"]; bp["D23"]=inputs["justice"]
  bp["D26"]=inputs["ff"]; bp["D27"]=inputs["gfa"]; bp["D28"]=inputs["do"]; bp["D31"]=inputs["hv"]
  for i,(d,t) in enumerate(inputs["lots"]): bp[f"B{34+i}"]=d; bp[f"C{34+i}"]=t
  bp["B46"]=c["regime"][0]; bp["B47"]=c["regime"][1]
  wb.save(f"in_{name}.xlsx")
json.dump(dict(inputs=inputs,cases=cases),open("cases.json","w"))
