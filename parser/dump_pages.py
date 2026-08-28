import pdfplumber

pdf_file = "[MAT] Ringkasan Kurikulum 2024 (1).pdf"
print(f"[*] Dumping first 15 pages of {pdf_file}...")

with pdfplumber.open(pdf_file) as pdf:
    for i in range(15):
        if i >= len(pdf.pages):
            break
        page = pdf.pages[i]
        text = page.extract_text()
        print(f"\n--- Halaman {i+1} ---")
        if text:
            # Tampilkan 15 baris pertama
            lines = text.split("\n")
            for line in lines[:15]:
                print(f"  {line}")
        else:
            print("  (Kosong)")
