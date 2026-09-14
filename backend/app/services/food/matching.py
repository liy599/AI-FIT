from __future__ import annotations

from dataclasses import dataclass


@dataclass
class FoodForMatch:
    id: int
    name: str
    display_name: str
    aliases: list[str]


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


def match_food_labels(labels: list[str], foods: list[FoodForMatch]) -> tuple[list[int], list[str]]:
    matched, unmatched, seen = [], [], set()
    for label in labels:
        best = max(
            ((max(_score(label, candidate) for candidate in [food.name, food.display_name, *food.aliases]), food.id)
             for food in foods),
            default=(0, None),
        )
        if best[1] is not None and best[0] >= 0.6:
            if best[1] not in seen:
                matched.append(best[1])
                seen.add(best[1])
        else:
            unmatched.append(label)
    return matched, unmatched
