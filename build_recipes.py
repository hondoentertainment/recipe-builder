"""Build recipes from analyzed images and export to Word."""

from recipe_extractor import Recipe
from word_exporter import export_recipes_to_word
import config

RECIPES = [
    Recipe(
        title="Mango-Orange Ice Pops",
        description="Bright, refreshing frozen treats perfect for a sunny afternoon — inspired by photos in your collection.",
        servings="6 popsicles",
        prep_time="15 minutes",
        cook_time="4+ hours freeze time",
        ingredients=[
            "2 cups mango chunks (fresh or frozen)",
            "1 cup orange juice",
            "2 tablespoons honey or agave syrup",
            "1 tablespoon lemon juice",
            "Pinch of salt",
            "6 popsicle molds and sticks",
        ],
        instructions=[
            "Blend mango chunks, orange juice, honey, lemon juice, and salt until completely smooth.",
            "Taste and adjust sweetness if needed.",
            "Pour mixture evenly into popsicle molds, leaving 1/4 inch at the top.",
            "Insert sticks and freeze for at least 4 hours, or until solid.",
            "Run molds under warm water for 10 seconds to release popsicles easily.",
        ],
        notes="For a creamier version, substitute 1/2 cup orange juice with coconut milk.",
        source_image="google_photo_4.jpg",
    ),
    Recipe(
        title="Orange Creamsicle Pops",
        description="Two-tone frozen pops with a vibrant orange fruit layer and creamy vanilla base.",
        servings="6 popsicles",
        prep_time="20 minutes",
        cook_time="6+ hours freeze time",
        ingredients=[
            "1 cup orange juice",
            "1 cup mango or peach puree",
            "2 tablespoons sugar",
            "1 cup whole milk or vanilla yogurt",
            "1 teaspoon vanilla extract",
            "2 tablespoons sweetened condensed milk",
            "6 popsicle molds and sticks",
        ],
        instructions=[
            "Blend orange juice, fruit puree, and 1 tablespoon sugar. Pour into molds filling only the bottom half. Freeze 2 hours until firm.",
            "Whisk milk, vanilla, condensed milk, and remaining sugar until smooth.",
            "Pour the creamy mixture over the frozen orange layer. Insert sticks.",
            "Freeze at least 4 more hours until completely solid.",
            "Briefly dip molds in warm water before serving.",
        ],
        notes="Layering works best when the first layer is fully frozen before adding the cream layer.",
        source_image="google_photo_6.jpg",
    ),
    Recipe(
        title="Summer Fruit Popsicle Variety Pack",
        description="A flexible base recipe for creating multiple fruit flavors from whatever is in season.",
        servings="8 popsicles",
        prep_time="10 minutes",
        cook_time="4+ hours freeze time",
        ingredients=[
            "3 cups mixed fruit (berries, mango, peaches, or melon)",
            "1/2 cup water or fruit juice",
            "3–4 tablespoons honey or maple syrup",
            "1 tablespoon lemon or lime juice",
            "Popsicle molds",
        ],
        instructions=[
            "Puree fruit with liquid and sweetener until smooth. Strain if you prefer fewer seeds.",
            "Divide mixture among molds if making multiple flavors.",
            "Freeze 45 minutes, then insert sticks (they'll stand upright in semi-frozen mixture).",
            "Freeze until solid, at least 3–4 hours.",
        ],
        notes="Google Photos automatically groups recipe and menu photos under Documents → Recipes & menus. Re-run the pipeline after signing in to extract your personal recipe collection.",
        source_image="google_photo_5.jpg",
    ),
]


def main():
    config.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output = config.OUTPUT_DIR / "recipes.docx"
    export_recipes_to_word(RECIPES, output, config.IMAGES_DIR)
    print(f"Saved {len(RECIPES)} recipes to {output}")


if __name__ == "__main__":
    main()
