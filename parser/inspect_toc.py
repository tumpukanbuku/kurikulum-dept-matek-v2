import pdfplumber
import glob

pdf_files = glob.glob("*.pdf")

for pdf_file in pdf_files:
    print(f"\n==========================================")
    print(f"Table of Contents dari: {pdf_file}")
    print(f"==========================================")
    
    with pdfplumber.open(pdf_file) as pdf:
        # Cari halaman dengan judul "DAFTAR ISI"
        toc_text = ""
        for i, page in enumerate(pdf.pages[:10]):
            text = page.extract_text()
            if text and "daftar isi" in text.lower():
                print(f"[+] Daftar Isi ditemukan di Halaman {i+1}")
                lines = text.split("\n")
                for line in lines:
                    if any(x in line.lower() for x in ["silabus", "lampiran", "mata kuliah", "deskripsi", "kurikulum"]):
                        print(f"  {line}")
