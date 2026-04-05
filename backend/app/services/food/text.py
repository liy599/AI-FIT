def normalize_food_text(input_text: str) -> str:
    lowered = input_text.lower().strip()
    cleaned = (
        lowered.replace("“", "")
        .replace("”", "")
        .replace('"', "")
        .replace("'", "")
        .replace("`", "")
        .replace("(", " ")
        .replace(")", " ")
        .replace("[", " ")
        .replace("]", " ")
        .replace("{", " ")
        .replace("}", " ")
        .replace(".", " ")
        .replace(",", " ")
        .replace(":", " ")
        .replace(";", " ")
        .replace("!", " ")
        .replace("?", " ")
        .replace("/", " ")
        .replace("\\", " ")
        .replace("|", " ")
    )
    normalized = " ".join(cleaned.split())
    if normalized.endswith("s") and len(normalized) > 3:
        return normalized[:-1]
    return normalized


def tokenize_words(input_text: str) -> list[str]:
    return [part for part in normalize_food_text(input_text).split(" ") if part]

