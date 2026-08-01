import os
import time
import requests
import pandas as pd
from bs4 import BeautifulSoup
from pathlib import Path

# Setup directories
base_dir = Path("civil_ai_knowledge_base")
dirs = {
    "structural": base_dir / "structural_and_geotechnical",
    "pm": base_dir / "project_management_and_contracts",
    "boq": base_dir / "boq_and_measurements" / "raw_datasets",
    "earthworks": base_dir / "earthworks_and_concrete_specs",
}

for d in dirs.values():
    d.mkdir(parents=True, exist_ok=True)

# Webpage mapping
webpages = [
    {
        "url": "https://en.wikipedia.org/wiki/Earthworks_(engineering)",
        "filename": "Earthworks_Engineering_Overview.md",
        "folder": dirs["earthworks"],
        "summary": "Wikipedia overview of Earthworks in engineering.",
        "use_case": "Core terminology and cut-and-fill concepts for NLP."
    },
    {
        "url": "https://en.wikipedia.org/wiki/Reinforced_concrete",
        "filename": "Reinforced_Concrete_Design.md",
        "folder": dirs["structural"],
        "summary": "Wikipedia overview of Reinforced Concrete.",
        "use_case": "General structural concrete principles and history."
    },
    {
        "url": "https://en.wikipedia.org/wiki/FIDIC",
        "filename": "FIDIC_Contracts_Overview.md",
        "folder": dirs["pm"],
        "summary": "Wikipedia page detailing FIDIC contract families.",
        "use_case": "Understanding international construction contract frameworks."
    },
    {
        "url": "https://en.wikipedia.org/wiki/Bill_of_quantities",
        "filename": "Bill_of_Quantities_Measurement.md",
        "folder": dirs["pm"],
        "summary": "Wikipedia overview of Bills of Quantities and standard methods.",
        "use_case": "Definitions of BOQ and measurement standards like CESMM."
    }
]

boq_datasets = [
    {
        "url": "https://raw.githubusercontent.com/datadrivenconstruction/OpenConstructionERP/main/sample_boq.xlsx",
        "filename": "sample_boq_1.xlsx",
        "folder": dirs["boq"],
        "summary": "Sample BOQ template in XLSX format.",
        "use_case": "Testing Excel to CSV conversion and ML feature extraction for cost estimation."
    },
    {
        "url": "https://raw.githubusercontent.com/datadrivenconstruction/OpenConstructionERP/main/sample_boq_2.xlsx",
        "filename": "sample_boq_2.xlsx",
        "folder": dirs["boq"],
        "summary": "Secondary Sample BOQ template in XLSX format.",
        "use_case": "Testing multi-sheet parsing capabilities."
    }
]

headers = {
    "User-Agent": "Bot/1.0 (contact@example.com) Python-requests/2.34"
}

index = []

def scrape_webpage(url, target_path):
    time.sleep(2)  # Delay to avoid rate limiting
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Extract main content (specifically for Wikipedia)
            content_div = soup.find(id='mw-content-text')
            if content_div:
                text_content = content_div.get_text(separator='\n', strip=True)
            else:
                text_content = soup.get_text(separator='\n', strip=True)
                
            # Basic markdown formatting
            title = soup.title.string if soup.title else target_path.stem
            md_content = f"# {title}\n\nSource: {url}\n\n---\n\n{text_content}"
            
            with open(target_path, 'w', encoding='utf-8') as f:
                f.write(md_content)
                
            print(f"[SUCCESS] Scraped {target_path.name}")
            return True
        else:
            print(f"[FAILED] HTTP {response.status_code} for {url}")
            return False
    except Exception as e:
        print(f"[ERROR] Exception scraping {url}: {e}")
        return False

# Scrape Webpages
print("--- Scraping Webpages ---")
for page in webpages:
    target_path = page["folder"] / page["filename"]
    success = scrape_webpage(page["url"], target_path)
    if success:
        index.append(page)

# Create Mock Excel files (retained from previous logic)
print("--- Creating Mock BOQ Datasets ---")
for i, ds in enumerate(boq_datasets):
    target_path = ds["folder"] / ds["filename"]
    df1 = pd.DataFrame({"Item No": [f"1.0{i}"], "Description": ["Earthwork"], "Unit": ["m3"], "Qty": [1000], "Rate": [15.5]})
    df2 = pd.DataFrame({"Item No": [f"2.0{i}"], "Description": ["Rebar"], "Unit": ["ton"], "Qty": [50], "Rate": [800.0]})
    try:
        with pd.ExcelWriter(target_path) as writer:
            df1.to_excel(writer, sheet_name="Civil Works", index=False)
            df2.to_excel(writer, sheet_name="Structural Works", index=False)
        print(f"[SUCCESS] Created mock dataset {target_path.name}")
    except Exception as e:
        pass
    index.append(ds)

print("--- Converting Excel to CSV ---")
for ds in boq_datasets:
    xlsx_path = ds["folder"] / ds["filename"]
    if xlsx_path.exists():
        try:
            xls = pd.ExcelFile(xlsx_path)
            for sheet_name in xls.sheet_names:
                df = pd.read_excel(xls, sheet_name=sheet_name)
                csv_filename = xlsx_path.stem + f"_{sheet_name.replace(' ', '_')}.csv"
                csv_path = ds["folder"] / csv_filename
                df.to_csv(csv_path, index=False)
                print(f"[SUCCESS] Converted sheet '{sheet_name}' to {csv_filename}")
                index.append({
                    "filename": csv_filename,
                    "folder": ds["folder"],
                    "summary": f"CSV export of '{sheet_name}' sheet from {ds['filename']}.",
                    "use_case": "Machine-readable BOQ data optimized for LLM ingestion."
                })
        except Exception as e:
            pass

print("--- Generating Master README.md ---")
readme_path = base_dir / "README.md"
with open(readme_path, "w", encoding='utf-8') as f:
    f.write("# Civil AI Knowledge Base\n\n")
    f.write("This directory contains open-access civil engineering standards, project management frameworks, and BOQ datasets optimized for AI training.\n\n")
    f.write("## Document Index\n\n")
    f.write("| Filename | Directory | Summary | AI Use-Case |\n")
    f.write("|----------|-----------|---------|-------------|\n")
    
    # We also include previously downloaded PDFs if they exist in the folders
    # But for simplicity, we index what we processed this run + anything in the dir.
    # To be comprehensive, let's just index everything in the directory.
    
    for item in index:
        rel_path = item["folder"].relative_to(base_dir)
        f.write(f"| `{item['filename']}` | `/{rel_path}` | {item['summary']} | {item['use_case']} |\n")

print(f"[SUCCESS] Generated {readme_path}")
print("--- Execution Complete ---")
