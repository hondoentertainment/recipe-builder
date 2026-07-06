"""Score and filter extracted recipes for export quality."""

from __future__ import annotations

import re

from recipe_extractor import Recipe

FOOD_WORDS = {
    "orange", "cookie", "cookies", "french", "salad", "oil", "garlic",
    "potato", "potatoes", "cake", "bread", "soup", "sauce", "chicken",
    "beef", "pork", "fish", "rice", "pasta", "cream", "butter", "sugar",
    "flour", "egg", "eggs", "milk", "cheese", "vanilla", "chocolate",
    "oatmeal", "toast", "muffin", "brownie", "pie", "roll", "popsicle",
    "juice", "cinnamon", "lemon", "honey", "salt", "pepper", "onion",
    "tomato", "basil", "dressing", "crouton", "greens", "spinach",
}


def _title_words(title: str) -> list[str]:
    return [w for w in re.split(r"[^A-Za-z]+", title) if len(w) >= 3]


def score_recipe(recipe: Recipe) -> int:
    title = recipe.title.strip()
    alpha = sum(c.isalpha() for c in title)
    words = _title_words(title)
    food_hits = sum(1 for w in words if w.lower() in FOOD_WORDS)
    ing = len(recipe.ingredients)
    steps = len(recipe.instructions)

    score = 0
    if len(title) >= 8 and alpha >= 6:
        score += 2
    elif len(title) >= 4 and alpha >= 3:
        score += 1

    if food_hits:
        score += min(food_hits, 3)

    if ing >= 4:
        score += 3
    elif ing >= 2:
        score += 1

    if steps >= 3:
        score += 3
    elif steps >= 1:
        score += 1

    readable_ing = sum(
        1 for item in recipe.ingredients
        if sum(c.isalpha() for c in item) >= 4
    )
    if ing and readable_ing / ing >= 0.6:
        score += 2

    readable_steps = sum(
        1 for step in recipe.instructions
        if len(step.split()) >= 4
    )
    if steps and readable_steps / steps >= 0.5:
        score += 2

    if alpha < 3 or title in {"+", "-", "=", "/", "\\", "<", ">"}:
        score -= 5

    return score


def is_garbage(recipe: Recipe) -> bool:
    title = recipe.title.strip()
    if len(title) <= 2:
        return True
    if sum(c.isalpha() for c in title) < 3:
        return True
    if not recipe.ingredients and not recipe.instructions:
        return True
    return score_recipe(recipe) < 4


def filter_recipes(
    recipes: list[Recipe],
    *,
    min_score: int = 10,
) -> tuple[list[Recipe], list[Recipe], list[Recipe]]:
    """Return (cleaned, partial, rejected) recipe lists."""
    cleaned: list[Recipe] = []
    partial: list[Recipe] = []
    rejected: list[Recipe] = []

    for recipe in recipes:
        score = score_recipe(recipe)
        if is_garbage(recipe) or score < 4:
            rejected.append(recipe)
        elif score >= min_score:
            cleaned.append(recipe)
        else:
            partial.append(recipe)

    cleaned.sort(key=score_recipe, reverse=True)
    partial.sort(key=score_recipe, reverse=True)
    return cleaned, partial, rejected
