import json, os, textwrap, datetime

# Recreate Top 50 product JSON
top50_products = [
    {"name": "Dolo 650", "category": "Pain & Fever"},
    {"name": "Crocin", "category": "Pain & Fever"},
    {"name": "Calpol 650", "category": "Pain & Fever"},
    {"name": "Vicks Action 500", "category": "Cold & Flu"},
    {"name": "Combiflam", "category": "Pain & Fever"},
    {"name": "Brufen", "category": "Pain & Fever"},
    {"name": "Nicip", "category": "Pain & Fever"},
    {"name": "Cetirizine", "category": "Allergy"},
    {"name": "Levocetirizine", "category": "Allergy"},
    {"name": "Allegra", "category": "Allergy"},
    {"name": "Ascoril Syrup", "category": "Cough"},
    {"name": "Benadryl Syrup", "category": "Cough"},
    {"name": "Corex", "category": "Cough"},
    {"name": "Cheston Cold", "category": "Cold & Flu"},
    {"name": "Azithromycin 500", "category": "Antibiotic"},
    {"name": "Amoxicillin", "category": "Antibiotic"},
    {"name": "Augmentin", "category": "Antibiotic"},
    {"name": "Cefixime", "category": "Antibiotic"},
    {"name": "Ciprofloxacin", "category": "Antibiotic"},
    {"name": "Ofloxacin", "category": "Antibiotic"},
    {"name": "Metronidazole", "category": "Antibiotic"},
    {"name": "Pantoprazole", "category": "Gastric"},
    {"name": "Pan-D", "category": "Gastric"},
    {"name": "Rabeprazole", "category": "Gastric"},
    {"name": "Digene", "category": "Gastric"},
    {"name": "Gelusil", "category": "Gastric"},
    {"name": "ENO", "category": "Gastric"},
    {"name": "ORS / Electral", "category": "Hydration"},
    {"name": "Metformin", "category": "Diabetes"},
    {"name": "Telma", "category": "BP"},
    {"name": "Amlodipine", "category": "BP"},
    {"name": "Ecosprin", "category": "Cardiac"},
    {"name": "Betnovate", "category": "Skin"},
    {"name": "Candid Cream", "category": "Skin"},
    {"name": "Soframycin", "category": "First Aid"},
    {"name": "Boroline", "category": "Skin"},
    {"name": "Burnol", "category": "First Aid"},
    {"name": "Dettol", "category": "Antiseptic"},
    {"name": "Savlon", "category": "Antiseptic"},
    {"name": "Digital Thermometer", "category": "Device"},
    {"name": "BP Monitor", "category": "Device"},
    {"name": "Surgical Face Mask", "category": "Consumable"},
    {"name": "Becosules", "category": "Vitamins"},
    {"name": "Zincovit", "category": "Vitamins"},
    {"name": "Limcee", "category": "Vitamins"},
    {"name": "Shelcal", "category": "Vitamins"},
    {"name": "Neurobion Forte", "category": "Vitamins"},
    {"name": "Zinc Oxide Ointment", "category": "Baby Care"},
    {"name": "Pampers Diapers", "category": "Baby Care"},
    {"name": "Stayfree Pads", "category": "Women Care"},
]

final_products = []
for i, p in enumerate(top50_products, start=1):
    final_products.append({
        "id": f"TOP{i:02d}",
        "name": p["name"],
        "category": p["category"],
        "isTop": True,
        "isHidden": False,
        "searchOnly": False
    })

path = "products_rewritten_top50.json"

with open(path, "w", encoding="utf-8") as f:
    json.dump(final_products, f, indent=2, ensure_ascii=False)

print("SUCCESS: File created ->", path)
