import openpyxl, json, glob
res={}
for f in glob.glob("out/in_*.xlsx"):
  n=f.split("in_")[1][:-5]; wb=openpyxl.load_workbook(f,data_only=True); bp=wb["BP en phase faisabilité"]
  res[n]={k:bp[k].value for k in ["B45","D8","D10","E10","D16","D19","E19","D24","E24","D29","D30","E30","D39","D43","D45","D47","D48","D49","D50","D51","E51","D52","D53","D55"]}
print(json.dumps(res,indent=1)); json.dump(res,open("excel_results.json","w"))
