"""CodingBuddy sample-data exercise. Run: python food-waste.py
Keep food-waste.csv next to this script. Amounts are invented for learning.
"""
import csv
import math
from pathlib import Path


def read_totals(path):
    totals, skipped = {}, 0
    with path.open(encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        if not reader.fieldnames or not {"day", "item", "grams"}.issubset(reader.fieldnames):
            raise ValueError("CSV headers must include day,item,grams.")
        for row in reader:
            day = (row.get("day") or "").strip()
            item = (row.get("item") or "").strip()
            try:
                grams = float(row.get("grams", ""))
            except (ValueError, TypeError):
                skipped += 1
                continue
            if not day or not item or grams < 0 or not math.isfinite(grams):
                skipped += 1
                continue
            totals[day] = totals.get(day, 0) + grams
    return totals, skipped


def main():
    try:
        totals, skipped = read_totals(Path(__file__).with_name("food-waste.csv"))
    except (OSError, ValueError) as error:
        print("Could not read data:", error)
        return
    if not totals:
        print("No valid measurements. Check the CSV.")
        return
    for day, grams in totals.items():
        print(f"{day}: {grams:g} g")
    total = sum(totals.values())
    print(f"Total: {total:g} g across {len(totals)} recorded days")
    print(f"Average per recorded day: {total / len(totals):.1f} g")
    print(f"Skipped rows: {skipped}")
    print("Sample data only. Meal counts and portion sizes may differ.")


if __name__ == "__main__":
    main()
