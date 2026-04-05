from __future__ import annotations

from dataclasses import dataclass

from .text import normalize_food_text, tokenize_words


@dataclass
class FoodForMatch:
    id: int
    name: str
    display_name: str
    aliases: list[str]


def _jaccard(left: list[str], right: list[str]) -> float:
    set_left = set(left)
    set_right = set(right)
    if not set_left and not set_right:
        return 1.0

    inter = len(set_left & set_right)
    union = len(set_left | set_right)
    return 0.0 if union == 0 else inter / union


def _levenshtein(left: str, right: str) -> int:
    if not left:
        return len(right)
    if not right:
        return len(left)

    dp = list(range(len(right) + 1))
    for i, left_char in enumerate(left, start=1):
        prev = dp[0]
        dp[0] = i
        for j, right_char in enumerate(right, start=1):
            current = dp[j]
            cost = 0 if left_char == right_char else 1
            dp[j] = min(dp[j] + 1, dp[j - 1] + 1, prev + cost)
            prev = current
    return dp[-1]


def _edit_similarity(left: str, right: str) -> float:
    normalized_left = normalize_food_text(left)
    normalized_right = normalize_food_text(right)
    max_len = max(len(normalized_left), len(normalized_right))
    if max_len == 0:
        return 1.0
    distance = _levenshtein(normalized_left, normalized_right)
    return 1 - distance / max_len


def _best_alias_score(label: str, food: FoodForMatch) -> float:
    label_norm = normalize_food_text(label)
    best = 0.0

    for candidate in [food.name, food.display_name, *food.aliases]:
        candidate_norm = normalize_food_text(candidate)
        if not candidate_norm:
            continue
        if label_norm == candidate_norm:
            return 1.0
        if label_norm in candidate_norm or candidate_norm in label_norm:
            best = max(best, 0.92)

        jac = _jaccard(tokenize_words(label_norm), tokenize_words(candidate_norm))
        ed = _edit_similarity(label_norm, candidate_norm)
        best = max(best, jac * 0.55 + ed * 0.45)

    return best


def match_food_labels(labels: list[str], foods: list[FoodForMatch]) -> tuple[list[int], list[str]]:
    matched_ids: list[int] = []
    unmatched_names: list[str] = []
    seen_ids: set[int] = set()

    for label in labels:
        normalized = normalize_food_text(label)
        if not normalized:
            continue

        best_id: int | None = None
        best_score = 0.0
        for food in foods:
            score = _best_alias_score(normalized, food)
            if score > best_score:
                best_score = score
                best_id = food.id

        if best_id is not None and best_score >= 0.6:
            if best_id not in seen_ids:
                seen_ids.add(best_id)
                matched_ids.append(best_id)
        else:
            unmatched_names.append(label)

    return matched_ids, unmatched_names

