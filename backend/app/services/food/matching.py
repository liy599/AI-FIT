from __future__ import annotations

from dataclasses import dataclass

from .stepfun import RecognizedFoodItem


@dataclass
class FoodForMatch:
    id: int
    name: str
    display_name: str
    aliases: list[str]


@dataclass
class MatchedFoodItem:
    food_id: int
    estimated_grams: float | None
    confidence: float | None


def _score(label: str, candidate: str) -> float:
    left, right = label.strip().lower(), candidate.strip().lower()
    if not left or not right:
        return 0
    if left == right:
        return 1
    if left in right or right in left:
        return 0.92
    left_chars, right_chars = set(left), set(right)
    return len(left_chars & right_chars) / max(len(left_chars | right_chars), 1)


def match_food_items(
    items: list[RecognizedFoodItem], foods: list[FoodForMatch]
) -> tuple[list[MatchedFoodItem], list[str]]:
    matched: list[MatchedFoodItem] = []
    unmatched: list[str] = []
    seen: set[int] = set()
    for item in items:
        best = max(
            ((max(_score(item.name, candidate) for candidate in [food.name, food.display_name, *food.aliases]), food.id)
             for food in foods),
            default=(0, None),
        )
        if best[1] is not None and best[0] >= 0.6:
            if best[1] not in seen:
                matched.append(MatchedFoodItem(
                    food_id=best[1], estimated_grams=item.estimated_grams, confidence=item.confidence,
                ))
                seen.add(best[1])
        else:
            unmatched.append(item.name)
    return matched, unmatched
