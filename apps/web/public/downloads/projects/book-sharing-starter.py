"""CodingBuddy book project: exercise scaffold, not the completed application.
Run this file to inspect the sample records. Complete the functions as you learn.
For a working menu, run book-sharing.py instead.
"""
from pathlib import Path

DATA = Path(__file__).with_name("books.json")
STARTER = [
    {"id": 1, "title": "De Men Phieu Luu Ky", "borrowed": False},
    {"id": 2, "title": "The Little Prince", "borrowed": True},
    {"id": 3, "title": "A Brief History of Time", "borrowed": False},
]


def find_available(books, keyword):
    """Lesson 2: return available books matching the title keyword."""
    # TODO: normalize the keyword; inspect each title and borrowing state.
    raise NotImplementedError("Complete find_available, then test it.")


def set_loan(books, book_id, borrowed):
    """Lesson 2: change one valid book state; return whether it changed."""
    # TODO: find the ID; do not report success for a missing or unchanged book.
    raise NotImplementedError("Complete set_loan, then test borrow and return.")


def save_books(books, path=DATA):
    """Lesson 3: save the list as UTF-8 JSON."""
    raise NotImplementedError("Complete save_books after the data lesson.")


def load_books(path=DATA):
    """Lesson 3: load valid saved data, or copy STARTER if no file exists."""
    # TODO: validate the list, field types and unique IDs after parsing JSON.
    raise NotImplementedError("Complete load_books; do not hide damaged data.")


if __name__ == "__main__":
    for book in STARTER:
        state = "on loan" if book["borrowed"] else "available"
        print(book["id"], book["title"], "-", state)
    print("Exercise scaffold: complete the TODO functions in your own copy.")
    print("For the finished example, run: python book-sharing.py")
