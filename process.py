import pandas as pd
import re
import json
import os
import glob
import sys
import warnings

# 關閉所有惱人的 Pandas 警告
warnings.filterwarnings('ignore')

def process_single_sheet(df, sheet_name):
    # ==========================================
    # 處理「跨行」合併儲存格
    # ==========================================
    df = df.fillna('')
    df = df.astype(str)
    
    for col in df.columns:
        df[col] = df[col].str.replace('台', '臺', regex=False).str.strip()

    start_idx = -1
    name_col_idx = -1
    for i in range(min(15, len(df))):
        row_list = df.iloc[i].tolist()
        for col_idx, val in enumerate(row_list):
            if '名稱' in val:
                start_idx = i
                name_col_idx = col_idx
                break
        if start_idx != -1:
            break

    if start_idx == -1:
        print(f"    ⚠️ 警告：無法在 {sheet_name} 找到「名稱」欄位，已略過。")
        return []

    end_idx = start_idx
    for i in range(start_idx + 1, min(start_idx + 4, len(df))):
        val = df.iloc[i, name_col_idx].strip()
        if val == '' or '名稱' in val or '機構' in val:
            end_idx = i
        else:
            break

    new_cols = []
    for c in range(len(df.columns)):
        col_name = "".join([df.iloc[r, c].strip() for r in range(start_idx, end_idx + 1)]).replace('\n', '').replace(' ', '')
        new_cols.append(col_name)

    df.columns = new_cols
    df = df.iloc[end_idx + 1:].reset_index(drop=True)

    # ==========================================
    # 動態鎖定欄位
    # ==========================================
    occupancy_col = None
    update_date = "未知時間"
    for col in df.columns:
        if '收容' in col and '人數' in col:
            occupancy_col = col
            match = re.search(r'(\d{2,3}年\d{1,2}月)', col)
            if match: update_date = match.group(1)
            break

    name_col = next((c for c in df.columns if '名稱' in c), None)
    city_col = next((c for c in df.columns if '縣市' in c), None)
    rating_col = next((c for c in df.columns if '評鑑' in c or '評等' in c), None)
    tel_col = next((c for c in df.columns if '電話' in c), None)
    manager_col = next((c for c in df.columns if '負責人' in c), None)
    address_col = next((c for c in df.columns if '地址' in c), None)
    establish_col = next((c for c in df.columns if '立案' in c or '開辦' in c), None)
    
    ownership_col = next((c for c in df.columns if '屬性' in c), None)
    
    ownership_col = next((c for c in df.columns if '屬性' in c), None)
    tax_id_col = next((c for c in df.columns if '統一編號' in c or '統編' in c), None)
    
    total_beds_col = next((c for c in df.columns if '核定' in c and '床' in c and '總' in c), None)
    if not total_beds_col: 
        total_beds_col = next((c for c in df.columns if '核定' in c and '總' in c), None)
    if not total_beds_col: 
        total_beds_col = next((c for c in df.columns if '核定' in c), None)

    type_cols = {
        "安養": next((c for c in df.columns if '安養' in c and '床' in c), None),
        "養護": next((c for c in df.columns if '養護' in c and '床' in c), None),
        "長照": next((c for c in df.columns if '長照' in c and '床' in c), None),
        "失智": next((c for c in df.columns if '失智' in c and '床' in c), None)
    }
    target_audience_col = next((c for c in df.columns if '收容對象' in c), None)
    note_col = next((c for c in df.columns if '備註' in c), None) # 新增擷取備註欄位

    sheet_data = []
    
    for index, row in df.iterrows():
        # 防呆：無效空行跳過
        if not name_col or row[name_col].strip() == "":
            continue

        # ==========================================
        # 【核心升級】全列掃描：徹底攔截歇業機構
        # ==========================================
        row_text = "".join(str(val) for val in row.values)
        if re.search(r'停業|歇業|廢止|撤銷|註銷', row_text):
            continue  # 只要整列任何一個角落有這些字，直接剔除，不進入資料庫！

        # 通過檢查的機構，狀態統一視為營業中
        status = '營業中'

        # 處理多支電話格式，利用正則表達式將空白、逗號、斜線全數替換為「、」
        if tel_col:
            raw_tel = str(row[tel_col]).strip()
            clean_tel = re.sub(r'[\s,/，]+', '、', raw_tel)
        else:
            clean_tel = ""

        rating_val = row[rating_col].strip() if rating_col else ""

        city_name = row[city_col].strip() if city_col and row[city_col].strip() != "" else sheet_name
        city_name = city_name.replace('台', '臺')

        raw_address = row[address_col].strip() if address_col else ""
        clean_address = re.sub(r'^\d{3,5}', '', raw_address) if raw_address else '無地址資料'

        district = "未知區"
        if clean_address != '無地址資料':
            match = re.search(r'(?:縣|市)(.{1,3}?[區鄉鎮市])', clean_address)
            if match: district = match.group(1)

        # 床位計算
        try:
            t_str = re.sub(r'[^\d.]', '', row[total_beds_col])
            t_beds = int(float(t_str)) if total_beds_col and t_str != "" else 0
        except ValueError:
            t_beds = 0

        try:
            occ_str = re.sub(r'[^\d.]', '', row[occupancy_col])
            occ = int(float(occ_str)) if occupancy_col and occ_str != "" else 0
        except ValueError:
            occ = 0

        avail_beds = max(0, t_beds - occ)

        # 萃取機構類別標籤 (types)
        types = []
        for t_name, t_col in type_cols.items():
            if t_col:
                try:
                    val_str = re.sub(r'[^\d.]', '', row[t_col])
                    val = int(float(val_str)) if val_str != "" else 0
                    if val > 0:
                        types.append(t_name)
                except ValueError:
                    pass
                    
        if len(types) == 0 and target_audience_col:
            audience_text = str(row[target_audience_col])
            for t_name in ["安養", "養護", "長照", "失智"]:
                if t_name in audience_text:
                    types.append(t_name)

        # 處理備註欄位 (避免 Pandas 讀到空值變成 nan)
        note_val = ""
        if note_col:
            raw_note = str(row[note_col]).strip()
            if raw_note.lower() != 'nan' and raw_note != '':
                note_val = raw_note

        item = {
            "name": row[name_col].strip(),
            "city": city_name,
            "district": district,
            "available_beds": avail_beds, 
            "total_beds": t_beds,
            "rating": rating_val,
            "tel": clean_tel,
            "address": clean_address,
            "manager": row[manager_col].strip() if manager_col else "未知",
            "establish_date": row[establish_col].strip() if establish_col else "未知",
            "ownership": row[ownership_col].strip() if ownership_col else "", 
            "tax_id": row[tax_id_col].strip() if tax_id_col else "",
            "update": update_date,
            "status": status,
            "types": types,
            "note": note_val  # 新增備註資料
        }
        sheet_data.append(item)

    return sheet_data

if __name__ == "__main__":
    print("啟動自動化處理程序...")
    
    excel_files = [f for f in glob.glob('*.xls*') if not os.path.basename(f).startswith('~$')]
    
    if len(excel_files) == 0:
        print("❌ 錯誤：找不到任何有效的 Excel 檔案！")
        sys.exit()
    elif len(excel_files) > 1:
        print(f"❌ 錯誤：找到多份 Excel 檔案 ({', '.join(excel_files)})，請確保資料夾內「只有一份」！")
        sys.exit()
        
    input_file = excel_files[0]
    
    try:
        with open(input_file, 'rb') as f:
            header = f.read(100).decode('utf-8', errors='ignore').lower()
            if '<html' in header or '<table' in header:
                print(f"🚨 抓到了！這是一個『偽裝成 Excel 的網頁檔』！請另存新檔為 .xlsx。")
                sys.exit()
    except Exception:
        pass 

    print(f"🔍 自動鎖定目標檔案：{input_file}")
    
    try:
        print("⏳ 開始讀取所有分頁 (這可能需要幾秒鐘)...")
        engine_type = 'openpyxl' if input_file.endswith('.xlsx') else None
        
        all_sheets = pd.read_excel(input_file, sheet_name=None, engine=engine_type, header=None)
        
        all_final_data = []
        for sheet_name, df in all_sheets.items():
            if df.empty:
                continue
            
            sheet_result = process_single_sheet(df, sheet_name)
            all_final_data.extend(sheet_result)
            print(f"  👉 完成 {sheet_name}：成功擷取 {len(sheet_result)} 家營業中機構")
            
        with open('data.json', 'w', encoding='utf-8') as f:
            json.dump(all_final_data, f, ensure_ascii=False, indent=4)
            
        print(f"\n🎉 完美成功！全台共統整了 {len(all_final_data)} 家營業中機構資料，已匯出至 data.json。")
        
    except PermissionError:
        print(f"\n❌ 錯誤：無法讀取檔案 (權限被拒絕)。請確認 Excel 軟體是否已經完全關閉！")
    except Exception as e:
        print(f"\n❌ 程式發生未預期的錯誤：{e}")