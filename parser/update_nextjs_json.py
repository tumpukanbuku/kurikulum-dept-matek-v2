import json
import os

target_paths = [
    "../katalog-matek/data/curriculum.json",
    "C:/Users/Adrian/Downloads/katalog-matek-source/katalog-matek/data/curriculum.json"
]

def update_json_file(filepath):
    if not os.path.exists(filepath):
        print(f"[!] Berkas tidak ditemukan: {filepath}")
        return
        
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    original_count = len(data["courses"])
    updated_courses = []
    
    for course in data["courses"]:
        code = course["code"].strip().upper()
        
        # 1. Hapus SCFI601110 Fisika Dasar
        if code == "SCFI601110":
            continue
            
        # 2. Hapus Logika dan Himpunan SCMA601100
        if code == "SCMA601100":
            continue
            
        # 3. Ubah Kategori ke Mata Kuliah Pilihan untuk Matematika:
        # Analisis Fungsional, Matematika Numerik, Teori Komputasi, Topik Khusus 1 (Teori Koding dan Kriptografi)
        if code in ["SCMA604135", "SCMA603431", "SCMA604412", "SCMA604991"]:
            course["category"] = "Mata Kuliah Pilihan"
            
        # 4. Ubah Kategori ke Mata Kuliah Pilihan untuk Statistika:
        # Topik Khusus 1,2,3,4
        if code in ["SCST603145", "SCST603146", "SCST603147", "SCST603148"]:
            course["category"] = "Mata Kuliah Pilihan"
            
        updated_courses.append(course)
        
    data["courses"] = updated_courses
    
    # Hitung statistik baru
    unique_codes = set(c["code"] for c in updated_courses)
    data["meta"]["recordCount"] = len(updated_courses)
    data["meta"]["uniqueCourseCount"] = len(unique_codes)
    
    # Hapus references ke unmapped
    if "validation" in data["meta"]:
        # Cek unmappedCategory
        if "unmappedCategory" in data["meta"]["validation"]:
            data["meta"]["validation"]["unmappedCategory"] = [
                c for c in data["meta"]["validation"]["unmappedCategory"] if "scma603421" in c or c not in ["scma601100", "scfi601110"]
            ]
            
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        
    print(f"[+] Berhasil memperbarui: {filepath} ({original_count} -> {len(updated_courses)} record)")

for path in target_paths:
    update_json_file(path)
