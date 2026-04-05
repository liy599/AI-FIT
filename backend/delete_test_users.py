import argparse
import csv
import os

from dotenv import load_dotenv


def _load_env(env_file: str) -> None:
    if env_file:
        load_dotenv(env_file, override=True)


def _read_csv_emails(csv_path: str) -> set[str]:
    emails: set[str] = set()
    with open(csv_path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or []
        email_key = None
        for k in fieldnames:
            nk = (k or "").strip().lstrip("\ufeff").lower()
            if nk == "email":
                email_key = k
                break

        for row in reader:
            if email_key is None:
                email = ""
            else:
                email = (row.get(email_key) or "")
            email = email.strip().lower()
            if email:
                emails.add(email)
    return emails


def main() -> int:
    parser = argparse.ArgumentParser(description="Delete test users from database")
    parser.add_argument("--env-file", default="", help="Path to backend .env (default: backend/.env)")
    parser.add_argument("--csv", default="", help="CSV file exported by create_test_users.ps1")
    parser.add_argument("--prefix", default="", help="Email prefix used for test accounts (e.g. qa)")
    parser.add_argument("--email-domain", default="", help="Email domain (e.g. example.com)")
    parser.add_argument("--commit", action="store_true", help="Actually delete; otherwise dry-run")

    args = parser.parse_args()

    default_env = os.path.join(os.path.dirname(__file__), ".env")
    env_file = args.env_file or default_env
    _load_env(env_file)

    from app import create_app
    from app.extensions import db
    from app.models import User

    app = create_app()
    with app.app_context():
        q = User.query

        csv_emails: set[str] = set()
        if args.csv:
            try:
                csv_emails = _read_csv_emails(args.csv)
            except FileNotFoundError:
                print(f"CSV not found: {args.csv}")
                return 1
            if not csv_emails:
                print(f"CSV has no emails: {args.csv}")
                return 1
            q = q.filter(User.email.in_(sorted(csv_emails)))
        else:
            if not args.prefix or not args.email_domain:
                print("Provide --csv or both --prefix and --email-domain")
                return 1
            pattern = f"{args.prefix.lower()}+%@{args.email_domain.lower()}"
            q = q.filter(User.email.like(pattern))

        users = q.order_by(User.id.asc()).all()
        if not users:
            print("No matching users found")
            return 0

        print(f"Matched users: {len(users)}")
        for u in users[:50]:
            print(f"- id={u.id} email={u.email} username={u.username}")
        if len(users) > 50:
            print(f"... and {len(users) - 50} more")

        if not args.commit:
            print("Dry-run only. Re-run with --commit to delete.")
            return 0

        for u in users:
            db.session.delete(u)
        db.session.commit()
        print("Deleted")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
