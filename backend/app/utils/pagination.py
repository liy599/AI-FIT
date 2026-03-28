from dataclasses import dataclass


@dataclass(frozen=True)
class Page:
    items: list
    page: int
    page_size: int
    total: int

    @property
    def pages(self) -> int:
        if self.page_size <= 0:
            return 1
        return (self.total + self.page_size - 1) // self.page_size


def parse_pagination(args, default_page=1, default_page_size=12, max_page_size=50):
    try:
        page = int(args.get("page", default_page))
    except Exception:
        page = default_page
    try:
        page_size = int(args.get("page_size", default_page_size))
    except Exception:
        page_size = default_page_size

    page = max(1, page)
    page_size = max(1, min(max_page_size, page_size))
    return page, page_size

