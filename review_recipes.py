"""Quick review of recipes in recipes_from_img.docx."""

import re
from docx import Document

doc = Document("output/recipes_from_img.docx")
recipes = []
current = None

for p in doc.paragraphs:
    text = p.text.strip()
    if not text:
        continue
    style = p.style.name if p.style else ""

    if style == "Heading 1":
        if current:
            recipes.append(current)
        current = {
            "title": text,
            "ingredients": [],
            "instructions": [],
            "section": None,
        }
    elif current and style == "Heading 2":
        current["section"] = text.lower()
    elif current and style == "List Bullet":
        current["ingredients"].append(text)
    elif current and current.get("section") == "instructions":
        if text and text[0].isdigit():
            current["instructions"].append(text)

if current:
    recipes.append(current)

FOOD_WORDS = {
    "orange", "cookie", "cookies", "french", "salad", "oil", "garlic",
    "potato", "potatoes", "cake", "bread", "soup", "sauce", "chicken",
    "beef", "pork", "fish", "rice", "pasta", "cream", "butter", "sugar",
    "flour", "egg", "eggs", "milk", "cheese", "vanilla", "chocolate",
    "oatmeal", "goimeal", "toast", "muffin", "brownie", "pie", "roll",
}


def quality(recipe: dict) -> tuple:
    title = recipe["title"]
    alpha = sum(c.isalpha() for c in title)
    words = [w for w in re.split(r"[^A-Za-z]+", title) if len(w) >= 3]
    food_hits = sum(1 for w in words if w.lower() in FOOD_WORDS)
    readable_title = alpha >= 8 and food_hits >= 1
    return (
        readable_title,
        food_hits,
        alpha,
        len(recipe["ingredients"]),
        len(recipe["instructions"]),
    )


def is_garbage(recipe: dict) -> bool:
    title = recipe["title"].strip()
    if len(title) <= 2:
        return True
    alpha = sum(c.isalpha() for c in title)
    if alpha < 5:
        return True
    words = [w for w in re.split(r"[^A-Za-z]+", title) if len(w) >= 3]
    if not words and len(recipe["ingredients"]) < 3:
        return True
    return False


ranked = sorted(recipes, key=quality, reverse=True)
usable = [r for r in ranked if quality(r)[0] and not is_garbage(r)]
mixed = [r for r in ranked if r not in usable and not is_garbage(r)]
garbage = [r for r in recipes if is_garbage(r)]

print(f"Total extracted: {len(recipes)}")
print(f"Skipped during run: 46 images (not classified as recipes)")
print(f"Usable-looking: {len(usable)}")
print(f"Partial / noisy: {len(mixed)}")
print(f"Garbage titles: {len(garbage)}")
print()

print("BEST CANDIDATES")
print("-" * 50)
for r in usable[:6]:
    q = quality(r)
    print(f"\n{r['title']}")
    print(f"  {q[3]} ingredients, {q[4]} steps")
    for item in r["ingredients"][:4]:
        print(f"  • {item[:85]}")
    if len(r["ingredients"]) > 4:
        print(f"  • ... +{len(r['ingredients']) - 4} more")
    for step in r["instructions"][:2]:
        print(f"  {step[:85]}")
    if len(r["instructions"]) > 2:
        print(f"  ... +{len(r['instructions']) - 2} more steps")

print("\n\nCOMMON ISSUES")
print("-" * 50)
print("• Vercel API returned 502 for all 118 images — OCR fallback only")
print("• Handwritten / photographed cookbook pages are hard for OCR")
print("• Many titles are fragments (single letters, symbols, noise)")
print("• Ingredients and steps often bleed together without section headers")
print("• File size is ~181 MB because every source photo is embedded")
